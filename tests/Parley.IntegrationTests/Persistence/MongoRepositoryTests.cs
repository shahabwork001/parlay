using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;
using Parley.Domain.Common;
using Parley.Infrastructure.Persistence.Mongo;
using Parley.IntegrationTests.Infrastructure;

namespace Parley.IntegrationTests.Persistence;

[Collection(InfrastructureCollection.Name)]
public sealed class MongoRepositoryTests(InfrastructureFixture fixture)
{
    internal sealed class Note : AggregateRoot
    {
        public Note(string text)
        {
            Text = text;
        }

        public string Text { get; private set; }

        public void Edit(string text) => Text = text;
    }

    internal sealed class NoteRepository(IMongoDatabase database) : MongoRepository<Note>(database, "notes");

    private NoteRepository CreateRepository()
    {
        var host = ServiceProviderFactory.CreateHost(fixture);
        return new NoteRepository(host.Services.GetRequiredService<IMongoDatabase>());
    }

    [Fact]
    public async Task Added_aggregate_can_be_read_back()
    {
        var repository = CreateRepository();
        var note = new Note("hello");

        await repository.AddAsync(note, TestContext.Current.CancellationToken);
        var loaded = await repository.GetByIdAsync(note.Id, TestContext.Current.CancellationToken);

        loaded.Should().NotBeNull();
        loaded!.Text.Should().Be("hello");
        loaded.Version.Should().Be(1);
    }

    [Fact]
    public async Task Update_increments_version()
    {
        var repository = CreateRepository();
        var note = new Note("draft");
        await repository.AddAsync(note, TestContext.Current.CancellationToken);

        note.Edit("final");
        var updated = await repository.UpdateAsync(note, TestContext.Current.CancellationToken);

        updated.Should().BeTrue();
        var loaded = await repository.GetByIdAsync(note.Id, TestContext.Current.CancellationToken);
        loaded!.Text.Should().Be("final");
        loaded.Version.Should().Be(2);
    }

    [Fact]
    public async Task Concurrent_update_with_stale_version_is_rejected()
    {
        var repository = CreateRepository();
        var note = new Note("v1");
        await repository.AddAsync(note, TestContext.Current.CancellationToken);
        var staleCopy = await repository.GetByIdAsync(note.Id, TestContext.Current.CancellationToken);

        note.Edit("v2");
        await repository.UpdateAsync(note, TestContext.Current.CancellationToken);
        staleCopy!.Edit("conflicting");
        var updated = await repository.UpdateAsync(staleCopy, TestContext.Current.CancellationToken);

        updated.Should().BeFalse();
        staleCopy.Version.Should().Be(1);
        var loaded = await repository.GetByIdAsync(note.Id, TestContext.Current.CancellationToken);
        loaded!.Text.Should().Be("v2");
    }

    [Fact]
    public async Task Delete_removes_aggregate()
    {
        var repository = CreateRepository();
        var note = new Note("temporary");
        await repository.AddAsync(note, TestContext.Current.CancellationToken);

        var deleted = await repository.DeleteAsync(note.Id, TestContext.Current.CancellationToken);

        deleted.Should().BeTrue();
        (await repository.GetByIdAsync(note.Id, TestContext.Current.CancellationToken)).Should().BeNull();
    }
}
