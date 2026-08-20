package postgresql

import "embed"

// Embed SQL files relative to this package's directory
//
//go:embed migrations/*.sql
var EmbedMigrations embed.FS