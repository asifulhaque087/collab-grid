.PHONY: seed build run watch

# Run database seed CLI
seed:
	@echo "Seeding database..."
	@go run cmd/seed/main.go

# Build binaries into the bin/ directory
build:
	@echo "Building binaries..."
	@go build -o bin/api ./cmd/main.go
	@go build -o bin/seed ./cmd/seed/main.go

# Run the main server entrypoint
run:
	@go run cmd/main.go

# Run the project in hot-reload watch mode using Air
watch:
	@echo "Starting Air in watch mode..."
	@air -c .air.toml
