import { Server } from '@aws-placeholder/aws-language-server-runtimes'
import { CredentialsProvider, Telemetry } from '@aws-placeholder/aws-language-server-runtimes/out/features'
import {
    InlineCompletionItemWithReferences,
    InlineCompletionListWithReferences,
    InlineCompletionWithReferencesParams,
} from '@aws-placeholder/aws-language-server-runtimes/out/features/lsp/inline-completions/protocolExtensions'
import { CancellationToken, InlineCompletionTriggerKind, Range } from 'vscode-languageserver'
import { Position, TextDocument } from 'vscode-languageserver-textdocument'
import { autoTrigger, triggerType } from './auto-trigger/autoTrigger'
import {
    CodeWhispererServiceBase,
    CodeWhispererServiceIAM,
    CodeWhispererServiceToken,
    GenerateSuggestionsResponse,
    Suggestion,
} from './codeWhispererService'
import { getSupportedLanguageId } from './languageDetection'
import { FileContext, truncateOverlapWithRightContext } from './mergeRightUtils'
import { CodeWhispererSession, SessionManager } from './session/sessionManager'
import { CodeWhispererServiceInvocationEvent } from './telemetry/types'

const EMPTY_RESULT = { items: [] }

// Both clients (token, sigv4) define their own types, this return value needs to match both of them.
const getFileContext = (params: { textDocument: TextDocument; position: Position; inferredLanguageId: string }) => {
    const left = params.textDocument.getText({
        start: { line: 0, character: 0 },
        end: params.position,
    })
    const right = params.textDocument.getText({
        start: params.position,
        end: params.textDocument.positionAt(params.textDocument.getText().length),
    })

    return {
        filename: params.textDocument.uri,
        programmingLanguage: {
            languageName: params.inferredLanguageId,
        },
        leftFileContent: left,
        rightFileContent: right,
    }
}

// Update session and send successful Service Invocation Telemetry
const processServiceInvocationResponse = (
    session: CodeWhispererSession,
    telemetry: Telemetry,
    response: GenerateSuggestionsResponse,
    startTime: number
): Suggestion[] => {
    // 1. Update Session information with correct response
    // 2. Emit service invocation Telemetry event
    // 3. Pass suggestions further
    const { suggestions, responseContext } = response

    session.requestContext.nextToken = responseContext.nextToken
    session.suggestions.push(...suggestions)

    // Build response context and emit Service Invocation telemetry event
    const duration = new Date().getTime() - startTime
    const data: CodeWhispererServiceInvocationEvent = {
        codewhispererRequestId: responseContext.requestId,
        codewhispererSessionId: responseContext.codewhispererSessionId,
        codewhispererLastSuggestionIndex: session.lastRecommendationIndex,
        codewhispererTriggerType: session.triggerType,
        codewhispererAutomatedTriggerType: session.autoTriggerType,
        result: 'Succeeded',
        duration: duration,
        codewhispererLineNumber: session.startPosition.line,
        codewhispererCursorOffset: session.startPosition.character,
        codewhispererLanguage: session.language,
        // TODO: Check if CodewhispererGettingStartedTask is necessary for LSP?
        codewhispererGettingStartedTask: undefined,
        credentialStartUrl: 'TODO: get the value from client',
    }
    telemetry.emit({
        name: 'ServiceInvocation',
        data,
    })

    return suggestions
}

const emitServiceInvocationFailure = (
    error: Error,
    session: CodeWhispererSession,
    telemetry: Telemetry,
    startTime: number
) => {
    const errorMessage = error ? String(error) : 'unknown'
    const reason = `CodeWhisperer Invocation Exception: ${errorMessage}`
    const duration = new Date().getTime() - startTime

    // Build response context and emit Service Invocation telemetry event
    const data: CodeWhispererServiceInvocationEvent = {
        codewhispererRequestId: undefined,
        codewhispererSessionId: session.codewhispererSessionId || undefined,
        codewhispererLastSuggestionIndex: session.lastRecommendationIndex,
        codewhispererTriggerType: session.triggerType,
        codewhispererAutomatedTriggerType: session.autoTriggerType,
        result: 'Failed',
        reason,
        duration: duration,
        codewhispererLineNumber: session.startPosition.line,
        codewhispererCursorOffset: session.startPosition.character,
        codewhispererLanguage: session.language,
        // TODO: Check if CodewhispererGettingStartedTask is necessary for LSP?
        codewhispererGettingStartedTask: undefined,
        credentialStartUrl: 'TODO: get the value from client',
    }
    telemetry.emit({
        name: 'ServiceInvocation',
        data,
    })

    // Re-throw an error to handle in the default catch all handled below.
    throw error
}

// Merge right context. Provided as partially applied function for easy map/flatmap-ing.
const mergeSuggestionsWithContext =
    ({ fileContext, range }: { fileContext: FileContext; range?: Range }) =>
    (suggestions: Suggestion[]): InlineCompletionItemWithReferences[] =>
        suggestions.map(suggestion => ({
            insertText: truncateOverlapWithRightContext(fileContext, suggestion.content),
            range,
            references: suggestion.references?.map(r => ({
                licenseName: r.licenseName,
                referenceUrl: r.url,
                referenceName: r.repository,
                position: r.recommendationContentSpan && {
                    startCharacter: r.recommendationContentSpan.start,
                    endCharacter: r.recommendationContentSpan.end,
                },
            })),
        }))

const filterReferences = (
    suggestions: InlineCompletionItemWithReferences[],
    includeSuggestionsWithCodeReferences: boolean
): InlineCompletionItemWithReferences[] => {
    if (includeSuggestionsWithCodeReferences) {
        return suggestions
    } else {
        return suggestions.filter(suggestion => suggestion.references == null || suggestion.references.length === 0)
    }
}

export const CodewhispererServerFactory =
    (service: (credentials: CredentialsProvider) => CodeWhispererServiceBase): Server =>
    ({ credentialsProvider, lsp, workspace, telemetry, logging }) => {
        const sessionManager = new SessionManager()
        const codeWhispererService = service(credentialsProvider)

        // Mutable state to track whether code with references should be included in
        // the response. No locking or concurrency controls, filtering is done
        // right before returning and is only guaranteed to be consistent within
        // the context of a single response.
        let includeSuggestionsWithCodeReferences = true

        const onInlineCompletionHandler = async (
            params: InlineCompletionWithReferencesParams,
            _token: CancellationToken
        ): Promise<InlineCompletionListWithReferences> => {
            return workspace.getTextDocument(params.textDocument.uri).then(textDocument => {
                if (!textDocument) {
                    logging.log(`textDocument [${params.textDocument.uri}] not found`)
                    return EMPTY_RESULT
                }

                const inferredLanguageId = getSupportedLanguageId(textDocument)
                if (!inferredLanguageId) {
                    logging.log(
                        `textDocument [${params.textDocument.uri}] with languageId [${textDocument.languageId}] not supported`
                    )
                    return EMPTY_RESULT
                }

                // Build request context
                const maxResults = params.context.triggerKind == InlineCompletionTriggerKind.Automatic ? 1 : 5
                const codewhispererTriggerType =
                    params.context.triggerKind == InlineCompletionTriggerKind.Automatic ? 'AutoTrigger' : 'OnDemand'
                const selectionRange = params.context.selectedCompletionInfo?.range
                const fileContext = getFileContext({ textDocument, inferredLanguageId, position: params.position })

                // TODO: Can we get this derived from a keyboard event in the future?
                // This picks the last non-whitespace character, if any, before the cursor
                const char = fileContext.leftFileContent.trim().at(-1) ?? ''

                if (
                    params.context.triggerKind === InlineCompletionTriggerKind.Automatic &&
                    !autoTrigger({
                        fileContext, // The left/right file context and programming language
                        lineNum: params.position.line, // the line number of the invocation, this is the line of the cursor
                        char, // Add the character just inserted, if any, before the invication position
                        ide: '', // TODO: Fetch the IDE in a platform-agnostic way (from the initialize request?)
                        os: '', // TODO: We should get this in a platform-agnostic way (i.e., compatible with the browser)
                        previousDecision: '', // TODO: Once we implement telemetry integration
                        triggerType: triggerType(fileContext), // The 2 trigger types currently influencing the Auto-Trigger are SpecialCharacter and Enter
                    })
                ) {
                    return EMPTY_RESULT
                }

                const requestContext = {
                    fileContext,
                    maxResults,
                    // TODO: Get nextToken from session if exists
                    nextToken: undefined,
                }

                // PoC: create new session on every incoming request,
                // and store recommendation session context
                const session = sessionManager.createSession({
                    startPosition: params.position,
                    triggerType: codewhispererTriggerType,
                    language: fileContext.programmingLanguage.languageName,
                    requestContext: requestContext,
                    // TODO: set correct autoTriggerType when AutoTrigger feature implementation is completed
                    // https://github.com/aws/aws-language-servers/pull/52
                    autoTriggerType: codewhispererTriggerType === 'AutoTrigger' ? 'Unknown' : undefined,
                })

                // Add timers to the call
                let startTime = new Date().getTime()

                console.log('Call generateSuggestions', requestContext)
                return codeWhispererService
                    .generateSuggestions(requestContext)
                    .catch(error => emitServiceInvocationFailure(error, session, telemetry, startTime))
                    .then(response => processServiceInvocationResponse(session, telemetry, response, startTime))
                    .then(mergeSuggestionsWithContext({ fileContext, range: selectionRange }))
                    .then(suggestions => filterReferences(suggestions, includeSuggestionsWithCodeReferences))
                    .then(items => ({ items }))
                    .catch(err => {
                        logging.log(`onInlineCompletion failure: ${err}`)
                        // Send failed service invocation event
                        return EMPTY_RESULT
                    })
            })
        }

        const updateConfiguration = async () =>
            lsp.workspace
                .getConfiguration('aws.codeWhisperer')
                .then(config => {
                    if (config && config['includeSuggestionsWithCodeReferences'] === false) {
                        includeSuggestionsWithCodeReferences = false
                        logging.log('Configuration updated to exclude suggestions with code references')
                    } else {
                        includeSuggestionsWithCodeReferences = true
                        logging.log('Configuration updated to include suggestions with code references')
                    }
                    if (config && config['shareCodeWhispererContentWithAWS'] === false) {
                        codeWhispererService.shareCodeWhispererContentWithAWS = false
                        logging.log('Configuration updated to not share code whisperer content with AWS')
                    } else {
                        codeWhispererService.shareCodeWhispererContentWithAWS = true
                        logging.log('Configuration updated to share code whisperer content with AWS')
                    }
                })
                .catch(reason => logging.log(`Error in GetConfiguration: ${reason}`))

        lsp.extensions.onInlineCompletionWithReferences(onInlineCompletionHandler)
        lsp.onInitialized(updateConfiguration)
        lsp.didChangeConfiguration(updateConfiguration)

        logging.log('Codewhisperer server has been initialised')

        return () => {
            /* do nothing */
        }
    }

export const CodeWhispererServerIAM = CodewhispererServerFactory(
    credentialsProvider => new CodeWhispererServiceIAM(credentialsProvider)
)
export const CodeWhispererServerToken = CodewhispererServerFactory(
    credentialsProvider => new CodeWhispererServiceToken(credentialsProvider)
)
