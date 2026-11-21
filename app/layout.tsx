import './globals.css';
import type { Metadata, Viewport } from 'next';
export const metadata: Metadata = { title: 'Jewellery ERP — CodeStudioHub', description: 'Gold, karigar, order, loss and GST management for jewellery manufacturers', manifest: '/manifest.webmanifest' };
export const viewport: Viewport = { themeColor: '#4f83e8', width: 'device-width', initialScale: 1 };
export default function Root({ children }: { children: React.ReactNode }) { return (<html lang="en"><body>{children}</body></html>); }
