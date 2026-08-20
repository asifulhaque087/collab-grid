.PHONY: seed build run watch

# Run database seed CLI
seed:
	@echo "Seeding database..."
	@go run ./cmd/seed

# Build binaries into the root build/ directory
build:
	@echo "Building binaries..."
	@CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o build/api ./cmd
	@CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o build/seed ./cmd/seed


# Run the main server entrypoint
run:
	@go run cmd/main.go
