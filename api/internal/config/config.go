package config

import (
	"fmt"
	"time"

	"github.com/caarlos0/env/v11"
	"github.com/go-playground/validator/v10"
	"github.com/joho/godotenv"
)

type Config struct {
	// Server & Network
	Port       int    `env:"PORT,required" validate:"gte=1024,lte=65535"`
	ClientURL  string `env:"CLIENT_URL,required" validate:"url"`
	CorsOrigin string `env:"CORS_ORIGIN,required" validate:"url"`

	// Infrastructure & Databases
	DatabaseURL string `env:"DATABASE_URL,required" validate:"url"`
	RedisURL    string `env:"REDIS_URL,required" validate:"url"`
	RabbitMQURL string `env:"RABBITMQ_URL,required" validate:"url"`

	// Auth Secrets & Durations
	AccessTokenSecret      string        `env:"ACCESS_TOKEN_SECRET,required" validate:"min=16"`
	AccessTokenExpiration  time.Duration `env:"ACCESS_TOKEN_EXPIRATION,required"`
	RefreshTokenSecret     string        `env:"REFRESH_TOKEN_SECRET,required" validate:"min=16"`
	RefreshTokenExpiration time.Duration `env:"REFRESH_TOKEN_EXPIRATION,required"`
	WSTokenSecret          string        `env:"WS_TOKEN_SECRET,required" validate:"min=16"`

	// OAuth (Google)
	GoogleClientID     string `env:"GOOGLE_CLIENT_ID,required"`
	GoogleClientSecret string `env:"GOOGLE_CLIENT_SECRET,required"`
	GoogleCallbackURL  string `env:"GOOGLE_CALLBACK_URL,required" validate:"url"`

	// SMTP & Email
	SMTPHost   string `env:"SMTP_HOST,required" validate:"hostname|ip"`
	SMTPPort   int    `env:"SMTP_PORT,required" validate:"gte=1,lte=65535"`
	SMTPSecure bool   `env:"SMTP_SECURE,required"`
	SMTPUser   string `env:"SMTP_USER,required" validate:"email"`
	SMTPPass   string `env:"SMTP_PASS,required"`
	MailFrom   string `env:"MAIL_FROM,required"`

	// Password Reset
	ResetTokenExpiration time.Duration `env:"RESET_TOKEN_EXPIRATION,required"`
	ResetPasswordURL     string        `env:"RESET_PASSWORD_URL,required" validate:"url"`
}

func Load() (*Config, error) {
	_ = godotenv.Load()
	cfg := &Config{}

	if err := env.Parse(cfg); err != nil {
		return nil, fmt.Errorf("env parse error: %w", err)
	}

	validate := validator.New()
	if err := validate.Struct(cfg); err != nil {
		return nil, fmt.Errorf("config validation error: %w", err)
	}

	return cfg, nil
}
