using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Conventions;
using MongoDB.Bson.Serialization.Serializers;
using Parley.Domain.Common;

namespace Parley.Infrastructure.Persistence.Mongo;

/// <summary>Process-wide BSON mapping rules. Registration is idempotent and thread-safe.</summary>
internal static class MongoConventions
{
    private static readonly Lazy<bool> Registration = new(RegisterOnce, LazyThreadSafetyMode.ExecutionAndPublication);

    public static void Register() => _ = Registration.Value;

    private static bool RegisterOnce()
    {
        var pack = new ConventionPack
        {
            new CamelCaseElementNameConvention(),
            new IgnoreExtraElementsConvention(true),
            new EnumRepresentationConvention(BsonType.String),
            new IgnoreIfNullConvention(true),
        };
        ConventionRegistry.Register("parley", pack, _ => true);

        BsonSerializer.TryRegisterSerializer(new GuidSerializer(GuidRepresentation.Standard));
        BsonSerializer.TryRegisterSerializer(new DateTimeOffsetSerializer(BsonType.DateTime));

        BsonClassMap.TryRegisterClassMap<Entity>(map =>
        {
            map.AutoMap();
            map.MapIdProperty(entity => entity.Id);
        });
        BsonClassMap.TryRegisterClassMap<AggregateRoot>(map =>
        {
            map.AutoMap();
            map.UnmapProperty(aggregate => aggregate.DomainEvents);
        });

        return true;
    }
}
