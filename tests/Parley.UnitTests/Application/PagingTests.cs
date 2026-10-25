using Parley.Application.Common;

namespace Parley.UnitTests.Application;

public sealed class PagingTests
{
    [Theory]
    [InlineData(0, 20, 1, 20)]
    [InlineData(-5, 20, 1, 20)]
    [InlineData(3, 0, 3, 1)]
    [InlineData(2, 500, 2, PageRequest.MaxPageSize)]
    public void Page_request_is_clamped_to_valid_bounds(int page, int size, int expectedPage, int expectedSize)
    {
        var request = new PageRequest(page, size);

        request.Page.Should().Be(expectedPage);
        request.PageSize.Should().Be(expectedSize);
    }

    [Fact]
    public void Skip_is_derived_from_page_and_size()
    {
        new PageRequest(3, 25).Skip.Should().Be(50);
    }

    [Theory]
    [InlineData(0, 0, false)]
    [InlineData(20, 1, false)]
    [InlineData(21, 2, true)]
    public void Paged_result_computes_total_pages(long total, int expectedPages, bool hasNext)
    {
        var result = new PagedResult<string>([], 1, 20, total);

        result.TotalPages.Should().Be(expectedPages);
        result.HasNextPage.Should().Be(hasNext);
    }
}
