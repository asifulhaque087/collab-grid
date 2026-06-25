import type { BoardCanvas } from "@/types/canvas";

// Mirrors the prototype's canvas seed data. Swap for a `fetch` to `@apps/api`
// once the board/widget endpoints exist.
const board: BoardCanvas = {
  boardId: null,
  slug: "friday-flash-sale",
  title: "Friday Flash Sale",
  access: "public",
  widgets: [
    { id: "w1", name: "Jamdani Saree — Premium", price: "৳4,500", qty: 33, state: "active", x: 120, y: 80, width: 190, img: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&h=300&fit=crop" },
    { id: "w2", name: "Kantha Stitch Scarf", price: "৳1,200", qty: 86, state: "active", x: 380, y: 60, width: 190, img: "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=400&h=300&fit=crop" },
    { id: "w3", name: "Panjabi — Eid Special", price: "৳3,800", qty: 192, state: "peer", x: 640, y: 100, width: 190, locker: "user-29fa…", lockTime: 47, img: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=300&fit=crop" },
    { id: "w5", name: "Leather Bag — Artisan", price: "৳8,900", qty: 12, state: "active", x: 460, y: 320, width: 190, img: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=300&fit=crop" },
    { id: "w6", name: "Brass Jewelry Set", price: "৳2,400", qty: 8, state: "peer", x: 740, y: 370, width: 190, locker: "user-83bc…", lockTime: 8, img: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400&h=300&fit=crop" },
    { id: "w7", name: "Silk Kurta — Classic", price: "৳2,800", qty: 18, state: "active", x: 900, y: 80, width: 190, img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop" },
    { id: "w8", name: "Cotton Dupatta — Hand Block", price: "৳950", qty: 45, state: "active", x: 900, y: 310, width: 190, img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=300&fit=crop" },
  ],
  inventory: [
    { id: "t1", name: "Jamdani Saree — Premium", price: "৳4,500", qty: 33, placed: true, img: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=200&h=200&fit=crop" },
    { id: "t2", name: "Kantha Stitch Scarf", price: "৳1,200", qty: 86, placed: true, img: "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=200&h=200&fit=crop" },
    { id: "t3", name: "Panjabi — Eid Special", price: "৳3,800", qty: 192, placed: true, img: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=200&h=200&fit=crop" },
    { id: "t4", name: "Nakshi Kantha — Limited", price: "৳6,200", qty: 0, placed: true, img: "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=200&h=200&fit=crop" },
    { id: "t5", name: "Leather Bag — Artisan", price: "৳8,900", qty: 12, placed: true, img: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=200&h=200&fit=crop" },
    { id: "t6", name: "Brass Jewelry Set", price: "৳2,400", qty: 8, placed: true, img: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=200&h=200&fit=crop" },
    { id: "t7", name: "Silk Kurta — Classic", price: "৳2,800", qty: 18, placed: true, img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop" },
    { id: "t8", name: "Cotton Dupatta — Hand Block", price: "৳950", qty: 45, placed: true, img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop" },
    { id: "t9", name: "Terracotta Vase", price: "৳1,600", qty: 20, placed: false, img: "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=200&h=200&fit=crop" },
    { id: "t10", name: "Jute Tote Bag", price: "৳550", qty: 60, placed: false, img: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=200&h=200&fit=crop" },
    { id: "t11", name: "Block Print Cushion Cover", price: "৳450", qty: 80, placed: false, img: "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=200&h=200&fit=crop" },
  ],
  peers: [
    { id: "p1", name: "Rafiq K.", color: "#7c3aed", x: 350, y: 180 },
    { id: "p2", name: "Nadia K.", color: "#e11d48", x: 680, y: 260 },
    { id: "p3", name: "Maruf H.", color: "#d97706", x: 500, y: 450 },
  ],
  presence: [
    { id: "a1", initials: "AM", gradient: "linear-gradient(135deg,var(--color-brand-light),var(--color-active))", online: true, title: "You" },
    { id: "a2", initials: "RK", gradient: "linear-gradient(135deg,#7c3aed,#6366f1)", online: true, title: "Rafiq Khan" },
    { id: "a3", initials: "NK", gradient: "linear-gradient(135deg,#e11d48,#f43f5e)", online: true, title: "Nadia Karim" },
    { id: "a4", initials: "TA", gradient: "linear-gradient(135deg,#0ea5e9,#38bdf8)", online: false, title: "Tanvir Ahmed" },
    { id: "a5", initials: "MH", gradient: "linear-gradient(135deg,#d97706,#fbbf24)", online: true, title: "Maruf Hossain" },
  ],
  presenceCount: 32,
};

export async function getBoardCanvas(slug: string): Promise<BoardCanvas> {
  return { ...board, slug };
}
