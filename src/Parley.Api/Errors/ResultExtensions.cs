using Parley.Domain.Common;

namespace Parley.Api.Errors;

/// <summary>Maps expected failures (<see cref="Error"/>) to RFC 7807 ProblemDetails responses.</summary>
internal static class ResultExtensions
{
    public static IResult ToProblem(this Error error) =>
        TypedResults.Problem(
            statusCode: StatusCodeFor(error.Type),
            title: TitleFor(error.Type),
            detail: error.Message,
            type: $"https://httpstatuses.io/{StatusCodeFor(error.Type)}",
            extensions: new Dictionary<string, object?> { ["errorCode"] = error.Code });

    public static IResult ToHttpResult<TValue>(this Result<TValue> result, Func<TValue, IResult> onSuccess) =>
        result.IsSuccess ? onSuccess(result.Value) : result.Error.ToProblem();

    public static IResult ToHttpResult(this Result result, Func<IResult> onSuccess) =>
        result.IsSuccess ? onSuccess() : result.Error.ToProblem();

    internal static int StatusCodeFor(ErrorType type) => type switch
    {
        ErrorType.Validation => StatusCodes.Status400BadRequest,
        ErrorType.Unauthorized => StatusCodes.Status401Unauthorized,
        ErrorType.Forbidden => StatusCodes.Status403Forbidden,
        ErrorType.NotFound => StatusCodes.Status404NotFound,
        ErrorType.Conflict => StatusCodes.Status409Conflict,
        ErrorType.RateLimited => StatusCodes.Status429TooManyRequests,
        ErrorType.Failure => StatusCodes.Status422UnprocessableEntity,
        _ => StatusCodes.Status500InternalServerError,
    };

    private static string TitleFor(ErrorType type) => type switch
    {
        ErrorType.Validation => "Validation failed",
        ErrorType.Unauthorized => "Authentication required",
        ErrorType.Forbidden => "Forbidden",
        ErrorType.NotFound => "Not found",
        ErrorType.Conflict => "Conflict",
        ErrorType.RateLimited => "Too many requests",
        _ => "Request could not be completed",
    };
}
