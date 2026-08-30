load('ext://namespace', 'namespace_create')

namespace_create('loot-board')

############################################## API ###############################################

api_dockerfile = './infra/development/docker/Dockerfile.api'

docker_build(
    'loot-board/api:tilt',
    '.',
    dockerfile=api_dockerfile,
    only=[
        './apps/api',
        './packages/common',
        './package.json',
        './pnpm-lock.yaml',
        './pnpm-workspace.yaml',
        './turbo.json'
    ],
    live_update=[
        # Maintain proper workspace hierarchy inside /app
        sync('./apps/api', '/app/apps/api'),
        sync('./packages/common', '/app/packages/common'),

        run(
            'pnpm --filter @loot-board/common build',
            trigger=['./packages/common/src']
        ),

        # Re-run pnpm install when workspace or app dependencies change
        run(
            'pnpm install',
            trigger=[
                './package.json',
                './pnpm-lock.yaml',
                './turbo.json',
                './apps/api/package.json',
                './packages/common/package.json',
            ]
        ),
    ],
)

# 2. Dedicated Migration Image (NO live_update, isolated triggers)
docker_build(
    'loot-board/api-migrate:tilt',
    '.',
    dockerfile=api_dockerfile,
    # Scope this image ONLY to files that actually alter database migrations
    only=[
        './apps/api/drizzle',
        './apps/api/src/schemas',             # Needed by seed.ts
        './apps/api/src/auth/permissions.ts',  # Needed by seed.ts
        './apps/api/src/auth/rbac.constants.ts', # Needed by seed.ts
        './apps/api/package.json',  # <--- ADD THIS LINE
        './packages/common',
        './package.json',
        './pnpm-lock.yaml',
        './pnpm-workspace.yaml',
        './turbo.json'
    ],
)


k8s_yaml(
    helm(
        './infra/charts/api',
        name='lootboard-api',
        namespace='loot-board',
        values=['./infra/charts/api/values.dev.yaml'],
        set=[
            'image.repository=loot-board/api',
            'image.migrateRepository=loot-board/api-migrate',
            'image.tag=tilt',
        ]
    )
)

k8s_resource(
    'lootboard-api',
    port_forwards='3001',
)



############################################## WEB ###############################################

web_dockerfile = './infra/development/docker/Dockerfile.web' # Adjust path if different

docker_build(
    'loot-board/web:tilt',
    '.',
    dockerfile=web_dockerfile,
    only=[
        './apps/web',
        './packages/common',
        './package.json',
        './pnpm-lock.yaml',
        './pnpm-workspace.yaml',
    ],
    live_update=[
        # Maintain proper workspace hierarchy inside /app
        sync('./apps/web', '/app/apps/web'),
        sync('./packages/common', '/app/packages/common'),

        # Re-run pnpm install when workspace or app dependencies change
        run(
            'pnpm install',
            trigger=[
                './package.json',
                './pnpm-lock.yaml',
                './apps/web/package.json',
                './packages/common/package.json',
            ]
        ),
    ],
)

k8s_yaml(
    helm(
        './infra/charts/web', # Adjust chart path if different
        name='lootboard-web',
        namespace='loot-board',
        values=['./infra/charts/web/values.dev.yaml'],
        set=[
            'image.repository=loot-board/web',
            'image.tag=tilt',
        ]
    )
)

k8s_resource(
    'lootboard-web',
    port_forwards='3000',
)