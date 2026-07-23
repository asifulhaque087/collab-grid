import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import { join } from 'node:path';
import { AccessTokenGuard } from '@/auth/guards/access-token.guard';
import { RoleGuard } from '@/auth/guards/role.guard';
import { LimitGuard } from '@/auth/guards/limit.guard';
import { RequirePermission } from '@/auth/decorators/require-permission.decorator';
import { GetUser } from '@/auth/decorators/get-user.decorator';
import { Action, Subjects } from '@/auth/permissions';
import type { AuthUser } from '@/auth/auth.types';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';

// End-user checkout. Public (anonymous buyers) — the unguessable order UUID
// gates invoice access.
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.orderService.create(dto);
  }

  // Tenant-scoped order listing — requires authentication and read:PaymentHistory.
  @Get()
  @UseGuards(AccessTokenGuard, RoleGuard, LimitGuard)
  @RequirePermission({ action: Action.Read, subject: Subjects.PaymentHistory })
  findAll(@GetUser() user: AuthUser) {
    return this.orderService.findAll(user.userId, user.primaryUserId);
  }

  @Get(':id/invoice')
  async invoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const order = await this.orderService.findOne(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoice-${id.slice(0, 8)}.pdf"`,
    );

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    const fontDir = join(__dirname, '..', '..', 'fonts');
    doc.registerFont('OpenSans', join(fontDir, 'OpenSans-Regular.ttf'));
    doc.registerFont('OpenSans-Bold', join(fontDir, 'OpenSans-Bold.ttf'));
    doc.registerFont('NotoSansBengali', join(fontDir, 'NotoSansBengali-Regular.ttf'));

    doc.pipe(res);

    const MARGIN = 50;
    const PAGE_WIDTH = 595.28;
    const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
    const COL2 = MARGIN + CONTENT_WIDTH * 0.55;

    function taka(n: number | string): string {
      return `Tk ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // ── Header ───────────────────────────────────────────
    doc.font('OpenSans-Bold').fontSize(28).fillColor('#0f172a').text('CollabGrid', MARGIN, 55);

    doc.font('OpenSans').fontSize(10).fillColor('#64748b')
      .text('INVOICE', MARGIN, 92, { width: CONTENT_WIDTH, align: 'right' });

    // Thin accent line
    doc.moveTo(MARGIN, 120)
      .lineTo(PAGE_WIDTH - MARGIN, 120)
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .stroke();

    // ── Invoice meta (left) + Status (right) ─────────────
    const metaY = 140;

    doc.font('OpenSans-Bold').fontSize(9).fillColor('#64748b').text('INVOICE NUMBER', MARGIN, metaY);
    doc.font('OpenSans').fontSize(10).fillColor('#0f172a').text(`#${id.slice(0, 8).toUpperCase()}`, MARGIN, metaY + 14);

    doc.font('OpenSans-Bold').fontSize(9).fillColor('#64748b').text('DATE', MARGIN, metaY + 34);
    doc.font('OpenSans').fontSize(10).fillColor('#0f172a')
      .text(new Date(order.createdAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      }), MARGIN, metaY + 48);

    // Status badge — right side
    const statusColor = order.status === 'paid' ? '#059669' : '#d97706';
    const statusBg = order.status === 'paid' ? '#ecfdf5' : '#fffbeb';
    const statusText = order.status.charAt(0).toUpperCase() + order.status.slice(1);

    doc.roundedRect(COL2 + 16, metaY, 80, 24, 4)
      .fillAndStroke(statusBg, statusBg);

    doc.font('OpenSans-Bold').fontSize(10).fillColor(statusColor)
      .text(statusText, COL2 + 16, metaY + 6, { width: 80, align: 'center' });

    // ── Bill To ──────────────────────────────────────────
    const billY = 220;
    doc.font('OpenSans-Bold').fontSize(9).fillColor('#64748b').text('BILL TO', MARGIN, billY);
    doc.font('OpenSans').fontSize(10).fillColor('#0f172a');

    let billLine = billY + 16;
    if (order.buyerName) { doc.text(order.buyerName, MARGIN, billLine); billLine += 16; }
    if (order.email) { doc.text(order.email, MARGIN, billLine); billLine += 16; }
    if (order.phone) { doc.text(order.phone, MARGIN, billLine); billLine += 16; }
    doc.text(order.address, MARGIN, billLine); billLine += 16;
    const region = [order.city, order.postalCode, order.country].filter(Boolean).join(', ');
    if (region) { doc.text(region, MARGIN, billLine); }

    // ── Items Table ──────────────────────────────────────
    const tableY = Math.max(billLine + 40, 340);
    const colX = {
      item: MARGIN,
      sku: MARGIN + 200,
      qty: MARGIN + 310,
      price: MARGIN + 360,
      total: MARGIN + 430,
    };

    // Table header
    doc.rect(MARGIN, tableY, CONTENT_WIDTH, 24).fill('#f1f5f9');
    doc.font('OpenSans-Bold').fontSize(8).fillColor('#475569');
    doc.text('ITEM', colX.item, tableY + 7);
    doc.text('SKU', colX.sku, tableY + 7);
    doc.text('QTY', colX.qty, tableY + 7);
    doc.text('PRICE', colX.price, tableY + 7);
    doc.text('TOTAL', colX.total, tableY + 7);

    // Table rows
    let rowY = tableY + 24;
    doc.font('OpenSans').fontSize(9).fillColor('#0f172a');

    for (let i = 0; i < order.items.length; i++) {
      const item = order.items[i];
      const lineTotal = Number(item.price) * item.quantity;

      if (i % 2 === 0) {
        doc.rect(MARGIN, rowY, CONTENT_WIDTH, 26).fill('#fafafa');
      }

      doc.fillColor('#0f172a');
      doc.text(item.name, colX.item, rowY + 7, { width: colX.sku - colX.item - 8 });
      doc.text(item.sku, colX.sku, rowY + 7);
      doc.text(String(item.quantity), colX.qty, rowY + 7);
      doc.text(taka(item.price), colX.price, rowY + 7);
      doc.font('OpenSans-Bold').text(taka(lineTotal), colX.total, rowY + 7);

      rowY += 26;
    }

    // ── Total ────────────────────────────────────────────
    const totalY = rowY + 16;
    doc.rect(MARGIN, totalY, CONTENT_WIDTH, 36).fill('#f8fafc');

    doc.font('OpenSans-Bold').fontSize(11).fillColor('#0f172a');
    doc.text('Total', MARGIN, totalY + 11);
    doc.text(taka(order.amountTotal), colX.total, totalY + 11);

    // ── Payment info ─────────────────────────────────────
    const payY = totalY + 60;
    doc.font('OpenSans-Bold').fontSize(9).fillColor('#64748b').text('PAYMENT METHOD', MARGIN, payY);
    doc.font('OpenSans').fontSize(10).fillColor('#0f172a')
      .text(
        `${order.paymentMethod.charAt(0).toUpperCase() + order.paymentMethod.slice(1)} card${order.cardLast4 ? ` ending in ${order.cardLast4}` : ''}`,
        MARGIN,
        payY + 16,
      );

    // ── Footer ───────────────────────────────────────────
    doc.fontSize(8).fillColor('#94a3b8').text(
      'Thank you for your purchase.',
      MARGIN,
      760,
      { width: CONTENT_WIDTH, align: 'center' },
    );

    doc.end();
  }
}
