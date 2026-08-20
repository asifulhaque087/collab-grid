load('ext://restart_process', 'docker_build_with_restart')
load('ext://namespace', 'namespace_create')

namespace_create('collab-grid')

### API ###

api_build_cmd = 'CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o build/api/server ./services/api/cmd/server'
migrate_build_cmd = 'CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o build/api/migrate ./services/api/cmd/migrate'
seed_build_cmd = 'CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o build/api/seed ./services/api/cmd/seed'

# compile_cmd = f'{api_build_cmd} && {migrate_build_cmd} && {seed_build_cmd}'
compile_cmd = '{} && {} && {}'.format(api_build_cmd, migrate_build_cmd, seed_build_cmd)

# compile_cmd = 'CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o build/api ./services/api/cmd'

if os.name == 'nt':
  compile_cmd = './infra/development/docker/api-build.bat'

local_resource(
  'api-compile',
  compile_cmd,
  deps=['./services/api'])


docker_build_with_restart(
  'collab-grid/api:tilt',
  '.',
  entrypoint=['/app/build/api/server'],
  dockerfile='./infra/development/docker/Dockerfile.api',
  only=[
    # './build/api',
    './build/api/server',
    # './shared',
  ],
  live_update=[
    # sync('./build', '/app/build'),
    sync('./build/api/server', '/app/build/api/server'),
    # sync('./shared', '/app/shared'),
  ],
)

k8s_yaml(
    helm(
        './infra/charts/api',              # Path to your chart directory
        name='collabgrid-api',           # Equivalent to helm release name
        namespace='collab-grid',                     # Target Kubernetes namespace
        values=['./infra/charts/api/values.dev.yaml'], # (Optional) dev values
        set=['image.repository=collab-grid/api', 'image.tag=tilt'] # Match image ref
    )
)


k8s_resource(
    'collabgrid-api', 
    port_forwards=8081, 
    resource_deps=['api-compile'],
    # namespace='collab-grid'
)


# k8s_resource('collabgrid-api-db-migrate', auto_init=True)

### End of API ###
