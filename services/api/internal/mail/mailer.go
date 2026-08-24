package mail

import (
	"bytes"
	"context"
	"fmt"
	netmail "net/mail"
	"net/smtp"

	"github.com/a-h/templ"
)

type SMTPConfig struct {
	Host     string
	Port     string
	Username string
	Password string
	From     string
}

type Mailer struct {
	config SMTPConfig
}

func NewMailer(cfg SMTPConfig) *Mailer {
	return &Mailer{config: cfg}
}

func (m *Mailer) Send(ctx context.Context, to string, subject string, component templ.Component) error {
	var body bytes.Buffer
	if err := component.Render(ctx, &body); err != nil {
		return fmt.Errorf("failed to render email template: %w", err)
	}

	// The SMTP envelope requires a bare address ("user@example.com"),
	// while the From: header may carry a display name ("Name <user@example.com>").
	envelopeFrom := m.config.From
	if parsed, err := netmail.ParseAddress(m.config.From); err == nil {
		envelopeFrom = parsed.Address
	}

	var msg bytes.Buffer
	headers := map[string]string{
		"From":         m.config.From,
		"To":           to,
		"Subject":      subject,
		"MIME-Version": "1.0",
		"Content-Type": "text/html; charset=\"UTF-8\"",
	}
	for k, v := range headers {
		msg.WriteString(fmt.Sprintf("%s: %s\r\n", k, v))
	}
	msg.WriteString("\r\n")
	msg.Write(body.Bytes())

	addr := fmt.Sprintf("%s:%s", m.config.Host, m.config.Port)
	auth := smtp.PlainAuth("", m.config.Username, m.config.Password, m.config.Host)

	if err := smtp.SendMail(addr, auth, envelopeFrom, []string{to}, msg.Bytes()); err != nil {
		return fmt.Errorf("failed to send email via smtp: %w", err)
	}

	return nil
}
