load('ext://restart_process', 'docker_build_with_restart')
load('ext://namespace', 'namespace_create')

namespace_create('collab-grid')

### API ###

api_build_cmd = 'CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -buildvcs=false -o build/api/server ./services/api/cmd/server'
migrate_build_cmd = 'CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -buildvcs=false -o build/api/migrate ./services/api/cmd/migrate'
seed_build_cmd = 'CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -buildvcs=false -o build/api/seed ./services/api/cmd/seed'

compile_cmd = '{} && {} && {}'.format(api_build_cmd, migrate_build_cmd, seed_build_cmd)
# compile_cmd = 'CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o build/api/server ./services/api/cmd/server'

if os.name == 'nt':
  compile_cmd = './infra/development/docker/api-build.bat'

local_resource(
  'api-compile',
  compile_cmd,
  deps=['./services/api'])

# Server image (wrapped with live reload for Deployment)
docker_build_with_restart(
    'collab-grid/api:tilt',
    '.',
    entrypoint=['/app/build/api/server'],
    dockerfile='./infra/development/docker/Dockerfile.api',
    only=['./build/api'],
    live_update=[
        sync('./build/api', '/app/build/api'),
    ],
)

# Migration image (plain image WITHOUT live reload wrapper for Job)
docker_build(
    'collab-grid/api-migrate:tilt',
    '.',
    dockerfile='./infra/development/docker/Dockerfile.api',
    only=['./build/api'],
)

k8s_yaml(
    helm(
        './infra/charts/api',
        name='collabgrid-api',
        namespace='collab-grid',
        values=['./infra/charts/api/values.dev.yaml'],
        set=[
            'image.repository=collab-grid/api',
            'image.migrateRepository=collab-grid/api-migrate',
            'image.tag=tilt'
        ]
    )
)


k8s_resource(
    'collabgrid-api', 
    # port_forwards='8081:3001', 
    port_forwards='3001', 
    resource_deps=['api-compile'],
)

k8s_resource('collabgrid-api-db-migrate', trigger_mode=TRIGGER_MODE_MANUAL)


# k8s_resource('collabgrid-api-db-migrate', auto_init=True)

### End of API ###
