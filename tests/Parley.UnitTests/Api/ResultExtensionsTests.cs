using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Parley.Api.Errors;
using Parley.Domain.Common;

namespace Parley.UnitTests.Api;

public sealed class ResultExtensionsTests
{
    [Theory]
    [InlineData(ErrorType.Validation, StatusCodes.Status400BadRequest)]
    [InlineData(ErrorType.Unauthorized, StatusCodes.Status401Unauthorized)]
    [InlineData(ErrorType.Forbidden, StatusCodes.Status403Forbidden)]
    [InlineData(ErrorType.NotFound, StatusCodes.Status404NotFound)]
    [InlineData(ErrorType.Conflict, StatusCodes.Status409Conflict)]
    [InlineData(ErrorType.RateLimited, StatusCodes.Status429TooManyRequests)]
    [InlineData(ErrorType.Failure, StatusCodes.Status422UnprocessableEntity)]
    public void Error_types_map_to_http_status_codes(ErrorType type, int expectedStatus)
    {
        ResultExtensions.StatusCodeFor(type).Should().Be(expectedStatus);
    }

    [Fact]
    public void Problem_carries_error_code_and_message()
    {
        var error = Error.Conflict("user.email_taken", "That email is already registered.");

        var result = error.ToProblem().Should().BeOfType<ProblemHttpResult>().Subject;

        result.StatusCode.Should().Be(StatusCodes.Status409Conflict);
        result.ProblemDetails.Detail.Should().Be("That email is already registered.");
        result.ProblemDetails.Extensions.Should().ContainKey("errorCode").WhoseValue.Should().Be("user.email_taken");
    }

    [Fact]
    public void Successful_result_uses_success_mapping()
    {
        Result<int> result = 7;

        var httpResult = result.ToHttpResult(value => TypedResults.Ok(value));

        httpResult.Should().BeOfType<Ok<int>>().Which.Value.Should().Be(7);
    }
}
