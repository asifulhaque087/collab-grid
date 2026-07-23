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
      `attachment; filename="invoice-${id}.pdf"`,
    );

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    doc.fontSize(22).text('CollabGrid', { continued: false });
    doc.fontSize(12).fillColor('#64748b').text('Order Invoice');
    doc.moveDown();

    doc.fillColor('#000');
    doc.fontSize(10).text(`Invoice #: ${order.id}`);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleString()}`);
    doc.text(`Status: ${order.status.toUpperCase()}`);
    doc.moveDown();

    doc.fontSize(12).text('Ship to', { underline: true });
    doc.fontSize(10);
    if (order.buyerName) doc.text(order.buyerName);
    if (order.phone) doc.text(order.phone);
    if (order.email) doc.text(order.email);
    doc.text(order.address);
    const region = [order.city, order.postalCode, order.country]
      .filter(Boolean)
      .join(', ');
    if (region) doc.text(region);
    doc.moveDown();

    doc.fontSize(12).text('Items', { underline: true });
    doc.moveDown(0.3);
    for (const item of order.items) {
      doc
        .fontSize(10)
        .text(
          `${item.name}  (${item.sku})   x${item.quantity}`,
          { continued: true },
        )
        .text(`৳${Number(item.price).toLocaleString()}`, { align: 'right' });
    }
    doc.moveDown();

    doc
      .fontSize(13)
      .text(`Total: ৳${Number(order.amountTotal).toLocaleString()}`, {
        align: 'right',
      });
    doc.moveDown();
    doc
      .fontSize(10)
      .fillColor('#64748b')
      .text(
        `Paid via ${order.paymentMethod}${
          order.cardLast4 ? ` •••• ${order.cardLast4}` : ''
        }`,
      );

    doc.end();
  }
}
