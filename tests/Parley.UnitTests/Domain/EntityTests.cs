using Parley.Domain.Common;

namespace Parley.UnitTests.Domain;

public sealed class EntityTests
{
    private sealed class Widget : AggregateRoot
    {
        public Widget()
        {
        }

        public Widget(Guid id)
            : base(id)
        {
        }

        public void DoSomething() => Raise(new WidgetChanged(DateTimeOffset.UnixEpoch));
    }

    private sealed class Gadget(Guid id) : AggregateRoot(id);

    private sealed record WidgetChanged(DateTimeOffset OccurredAt) : IDomainEvent;

    [Fact]
    public void New_entities_get_unique_time_ordered_ids()
    {
        var first = new Widget();
        var second = new Widget();

        first.Id.Should().NotBe(second.Id);
        first.Id.Version.Should().Be(7);
    }

    [Fact]
    public void Entities_with_same_type_and_id_are_equal()
    {
        var id = Guid.CreateVersion7();

        new Widget(id).Should().Be(new Widget(id));
        new Widget(id).GetHashCode().Should().Be(new Widget(id).GetHashCode());
    }

    [Fact]
    public void Entities_of_different_types_are_never_equal()
    {
        var id = Guid.CreateVersion7();

        new Widget(id).Equals(new Gadget(id)).Should().BeFalse();
    }

    [Fact]
    public void Domain_events_are_collected_and_cleared()
    {
        var widget = new Widget();

        widget.DoSomething();
        widget.DomainEvents.Should().ContainSingle().Which.Should().BeOfType<WidgetChanged>();

        widget.ClearDomainEvents();
        widget.DomainEvents.Should().BeEmpty();
    }
}
