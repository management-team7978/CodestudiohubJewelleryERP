import './globals.css';
import type { Metadata, Viewport } from 'next';
export const metadata: Metadata = { title: 'swastikjewellersERP', description: 'Gold, karigar, order, loss and GST management for Swastik Jewellers', manifest: '/manifest.webmanifest' };
export const viewport: Viewport = { themeColor: '#002144', width: 'device-width', initialScale: 1 };
export default function Root({ children }: { children: React.ReactNode }) { return (<html lang="en"><body>{children}</body></html>); }
