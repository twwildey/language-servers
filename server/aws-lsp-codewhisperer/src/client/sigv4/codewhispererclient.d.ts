/**
 * THIS FILE IS AUTOGENERATED BY 'generateServiceClient.ts'.
 * DO NOT EDIT BY HAND.
 */

import { ConfigBase as Config } from 'aws-sdk/lib/config-base'
import { AWSError } from 'aws-sdk/lib/error'
import { Request } from 'aws-sdk/lib/request'
import { Service, ServiceConfigurationOptions } from 'aws-sdk/lib/service'
interface Blob {}
declare class CodeWhispererClient extends Service {
    /**
     * Constructs a service object. This object has one method for each API operation.
     */
    constructor(options?: CodeWhispererClient.Types.ClientConfiguration)
    config: Config & CodeWhispererClient.Types.ClientConfiguration
    /**
     *
     */
    createCodeScan(
        params: CodeWhispererClient.Types.CreateCodeScanRequest,
        callback?: (err: AWSError, data: CodeWhispererClient.Types.CreateCodeScanResponse) => void
    ): Request<CodeWhispererClient.Types.CreateCodeScanResponse, AWSError>
    /**
     *
     */
    createCodeScan(
        callback?: (err: AWSError, data: CodeWhispererClient.Types.CreateCodeScanResponse) => void
    ): Request<CodeWhispererClient.Types.CreateCodeScanResponse, AWSError>
    /**
     *
     */
    createCodeScanUploadUrl(
        params: CodeWhispererClient.Types.CreateUploadUrlRequest,
        callback?: (err: AWSError, data: CodeWhispererClient.Types.CreateUploadUrlResponse) => void
    ): Request<CodeWhispererClient.Types.CreateUploadUrlResponse, AWSError>
    /**
     *
     */
    createCodeScanUploadUrl(
        callback?: (err: AWSError, data: CodeWhispererClient.Types.CreateUploadUrlResponse) => void
    ): Request<CodeWhispererClient.Types.CreateUploadUrlResponse, AWSError>
    /**
     *
     */
    generateRecommendations(
        params: CodeWhispererClient.Types.GenerateRecommendationsRequest,
        callback?: (err: AWSError, data: CodeWhispererClient.Types.GenerateRecommendationsResponse) => void
    ): Request<CodeWhispererClient.Types.GenerateRecommendationsResponse, AWSError>
    /**
     *
     */
    generateRecommendations(
        callback?: (err: AWSError, data: CodeWhispererClient.Types.GenerateRecommendationsResponse) => void
    ): Request<CodeWhispererClient.Types.GenerateRecommendationsResponse, AWSError>
    /**
     *
     */
    getCodeScan(
        params: CodeWhispererClient.Types.GetCodeScanRequest,
        callback?: (err: AWSError, data: CodeWhispererClient.Types.GetCodeScanResponse) => void
    ): Request<CodeWhispererClient.Types.GetCodeScanResponse, AWSError>
    /**
     *
     */
    getCodeScan(
        callback?: (err: AWSError, data: CodeWhispererClient.Types.GetCodeScanResponse) => void
    ): Request<CodeWhispererClient.Types.GetCodeScanResponse, AWSError>
    /**
     *
     */
    listCodeScanFindings(
        params: CodeWhispererClient.Types.ListCodeScanFindingsRequest,
        callback?: (err: AWSError, data: CodeWhispererClient.Types.ListCodeScanFindingsResponse) => void
    ): Request<CodeWhispererClient.Types.ListCodeScanFindingsResponse, AWSError>
    /**
     *
     */
    listCodeScanFindings(
        callback?: (err: AWSError, data: CodeWhispererClient.Types.ListCodeScanFindingsResponse) => void
    ): Request<CodeWhispererClient.Types.ListCodeScanFindingsResponse, AWSError>
}
declare namespace CodeWhispererClient {
    export type ArtifactType = 'SourceCode' | 'BuiltJars' | string
    export type CodeScanStatus = 'Completed' | 'Pending' | 'Failed' | string
    export interface CreateCodeScanRequest {
        artifacts: ArtifactMap
        programmingLanguage: ProgrammingLanguage
        clientToken?: CreateCodeScanRequestClientTokenString
    }
    export type CreateCodeScanRequestClientTokenString = string
    export interface CreateCodeScanResponse {
        jobId: CreateCodeScanResponseJobIdString
        status: CodeScanStatus
        errorMessage?: string
    }
    export type CreateCodeScanResponseJobIdString = string
    export interface CreateUploadUrlRequest {
        contentMd5?: CreateUploadUrlRequestContentMd5String
        artifactType?: ArtifactType
    }
    export type CreateUploadUrlRequestContentMd5String = string
    export interface CreateUploadUrlResponse {
        uploadId: UploadId
        uploadUrl: PreSignedUrl
        kmsKeyArn?: ResourceArn
    }

    export interface FileContext {
        leftFileContent: FileContextLeftFileContentString
        rightFileContent: FileContextRightFileContentString
        filename: FileContextFilenameString
        programmingLanguage: ProgrammingLanguage
    }
    export type FileContextFilenameString = string
    export type FileContextLeftFileContentString = string
    export type FileContextRightFileContentString = string
    export interface GenerateRecommendationsRequest {
        fileContext: FileContext
        maxResults?: GenerateRecommendationsRequestMaxResultsInteger
        nextToken?: GenerateRecommendationsRequestNextTokenString
        referenceTrackerConfiguration?: ReferenceTrackerConfiguration
    }
    export type GenerateRecommendationsRequestMaxResultsInteger = number
    export type GenerateRecommendationsRequestNextTokenString = string
    export interface GenerateRecommendationsResponse {
        recommendations?: RecommendationsList
        nextToken?: string
    }
    export interface GetCodeScanRequest {
        jobId: GetCodeScanRequestJobIdString
    }
    export type GetCodeScanRequestJobIdString = string
    export interface GetCodeScanResponse {
        status: CodeScanStatus
        errorMessage?: string
    }
    export interface Import {
        statement?: ImportStatementString
    }
    export type ImportStatementString = string
    export type Imports = Import[]
    export interface ListCodeScanFindingsRequest {
        jobId: ListCodeScanFindingsRequestJobIdString
        nextToken?: PaginationToken
        codeScanFindingsSchema: CodeScanFindingsSchema
    }
    export type ListCodeScanFindingsRequestJobIdString = string
    export interface ListCodeScanFindingsResponse {
        nextToken?: PaginationToken
        codeScanFindings: string
    }
    export interface ProgrammingLanguage {
        languageName: ProgrammingLanguageLanguageNameString
    }
    export type ProgrammingLanguageLanguageNameString = string
    export interface Recommendation {
        content: RecommendationContentString
        references?: References
        mostRelevantMissingImports?: Imports
    }
    export type RecommendationContentString = string
    export type RecommendationsList = Recommendation[]
    export type RecommendationsWithReferencesPreference = 'BLOCK' | 'ALLOW' | string
    export interface Reference {
        licenseName?: ReferenceLicenseNameString
        repository?: ReferenceRepositoryString
        url?: ReferenceUrlString
        recommendationContentSpan?: Span
    }
    export type ReferenceLicenseNameString = string
    export type ReferenceRepositoryString = string
    export interface ReferenceTrackerConfiguration {
        recommendationsWithReferences: RecommendationsWithReferencesPreference
    }
    export type ReferenceUrlString = string
    export type References = Reference[]
    export interface Span {
        start?: SpanStartInteger
        end?: SpanEndInteger
    }
    export type SpanEndInteger = number
    export type SpanStartInteger = number
    export type String = string
    /**
     * A string in YYYY-MM-DD format that represents the latest possible API version that can be used in this service. Specify 'latest' to use the latest possible version.
     */
    export type apiVersion = '2022-06-15' | 'latest' | string
    export interface ClientApiVersions {
        /**
         * A string in YYYY-MM-DD format that represents the latest possible API version that can be used in this service. Specify 'latest' to use the latest possible version.
         */
        apiVersion?: apiVersion
    }
    export type ClientConfiguration = ServiceConfigurationOptions & ClientApiVersions
    /**
     * Contains interfaces for use with the CodeWhispererClient client.
     */
    export import Types = CodeWhispererClient
}
export = CodeWhispererClient
