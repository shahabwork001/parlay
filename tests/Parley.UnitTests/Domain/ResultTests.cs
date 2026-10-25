using Parley.Domain.Common;

namespace Parley.UnitTests.Domain;

public sealed class ResultTests
{
    private static readonly Error SampleError = Error.NotFound("thing.not_found", "Thing was not found.");

    [Fact]
    public void Success_result_exposes_value()
    {
        Result<int> result = 42;

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(42);
        result.Error.Should().BeNull();
    }

    [Fact]
    public void Failure_result_exposes_error()
    {
        Result<int> result = SampleError;

        result.IsFailure.Should().BeTrue();
        result.Error.Should().Be(SampleError);
    }

    [Fact]
    public void Reading_value_of_failed_result_throws()
    {
        Result<int> result = SampleError;

        var read = () => result.Value;

        read.Should().Throw<InvalidOperationException>().WithMessage("*thing.not_found*");
    }

    [Fact]
    public void Error_factories_set_the_error_type()
    {
        Error.Validation("c", "m").Type.Should().Be(ErrorType.Validation);
        Error.Conflict("c", "m").Type.Should().Be(ErrorType.Conflict);
        Error.Unauthorized("c", "m").Type.Should().Be(ErrorType.Unauthorized);
        Error.Forbidden("c", "m").Type.Should().Be(ErrorType.Forbidden);
        Error.RateLimited("c", "m").Type.Should().Be(ErrorType.RateLimited);
        new Error("c", "m").Type.Should().Be(ErrorType.Failure);
    }
}
