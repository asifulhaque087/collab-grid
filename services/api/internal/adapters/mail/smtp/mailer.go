package smtp

import (
	"bytes"
	"context"
	"fmt"
	netmail "net/mail"
	"net/smtp"
	"strings"

	"github.com/a-h/templ"

	"github.com/asifulhaque087/loot-board/services/api/internal/adapters/mail/smtp/templates"
)

const defaultResetPasswordSubject = "Reset Your Password"

type SMTPMailerConfig struct {
	Host     string
	Port     string
	Username string
	Password string
	From     string
}

type SMTPMailer struct {
	config SMTPMailerConfig
}

func NewMailer(cfg SMTPMailerConfig) *SMTPMailer {
	return &SMTPMailer{config: cfg}
}

func (m *SMTPMailer) Send(ctx context.Context, to string, subject string, component templ.Component) error {
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

func (p *SMTPMailer) SendPasswordResetEmail(to string, name string, resetURL string, expirationMinutes int, subject ...string) error {
	subj := defaultResetPasswordSubject
	if len(subject) > 0 && subject[0] != "" {
		subj = subject[0]
	}

	component := templates.ResetPasswordEmail(name, resetURL, expirationMinutes)

	err := p.Send(context.Background(), to, subj, component)
	if err != nil {
		return fmt.Errorf("SendPasswordResetEmail: %w", err)
	}
	return nil
}

func (p *SMTPMailer) SendOrderInvoiceEmail(to string, order templates.InvoiceOrder, items []templates.InvoiceItem) error {
	id := order.ID
	if len(id) > 8 {
		id = id[:8]
	}
	subject := fmt.Sprintf("Your LootBoard invoice #%s", strings.ToUpper(id))

	component := templates.OrderInvoiceEmail(order, items)

	err := p.Send(context.Background(), to, subject, component)
	if err != nil {
		return fmt.Errorf("SendOrderInvoiceEmail: %w", err)
	}
	return nil
}
