# syntax=docker/dockerfile:1.7
# Multi-target build: `--target api` or `--target workers`.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY global.json Directory.Build.props Directory.Packages.props ./
COPY src/Parley.Domain/Parley.Domain.csproj src/Parley.Domain/
COPY src/Parley.Application/Parley.Application.csproj src/Parley.Application/
COPY src/Parley.Infrastructure/Parley.Infrastructure.csproj src/Parley.Infrastructure/
COPY src/Parley.Api/Parley.Api.csproj src/Parley.Api/
COPY src/Parley.Workers/Parley.Workers.csproj src/Parley.Workers/
RUN --mount=type=cache,id=nuget,target=/root/.nuget/packages \
    dotnet restore src/Parley.Api/Parley.Api.csproj && \
    dotnet restore src/Parley.Workers/Parley.Workers.csproj
COPY src/ src/
RUN --mount=type=cache,id=nuget,target=/root/.nuget/packages \
    dotnet publish src/Parley.Api/Parley.Api.csproj -c Release -o /out/api --no-restore /p:UseAppHost=false && \
    dotnet publish src/Parley.Workers/Parley.Workers.csproj -c Release -o /out/workers --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime-base
ENV ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_gcServer=1 \
    DOTNET_TieredPGO=1
WORKDIR /app
USER $APP_UID

FROM runtime-base AS api
ENV ASPNETCORE_HTTP_PORTS=8080
COPY --from=build --chown=$APP_UID /out/api ./
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/health/live > /dev/null || exit 1
ENTRYPOINT ["dotnet", "Parley.Api.dll"]

FROM runtime-base AS workers
ENV ASPNETCORE_HTTP_PORTS=8081
COPY --from=build --chown=$APP_UID /out/workers ./
EXPOSE 8081
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8081/health/live > /dev/null || exit 1
ENTRYPOINT ["dotnet", "Parley.Workers.dll"]
