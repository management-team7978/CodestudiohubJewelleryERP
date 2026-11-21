'use client';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
const COLORS = ['#4f83e8', '#4a9b5b', '#d4a72c', '#e5484d', '#8b5cf6', '#06b6d4', '#f97316', '#64748b'];
const tip = { contentStyle: { borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 } };
export function TrendChart({ data, k = 'v', name = 'Loss (g fine)' }: { data: { l: string; v: number }[]; k?: string; name?: string }) {
  return (<ResponsiveContainer width="100%" height={260}><LineChart data={data} margin={{ left: -10, right: 8, top: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" /><XAxis dataKey="l" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip {...tip} /><Line type="monotone" dataKey={k} name={name} stroke="#e5484d" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer>);
}
export function BarCompare({ data, name = 'Loss (g fine)' }: { data: { l: string; v: number }[]; name?: string }) {
  return (<ResponsiveContainer width="100%" height={260}><BarChart data={data} margin={{ left: -10, right: 8, top: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" /><XAxis dataKey="l" tick={{ fontSize: 11 }} interval={0} angle={-20} height={50} textAnchor="end" /><YAxis tick={{ fontSize: 11 }} /><Tooltip {...tip} /><Bar dataKey="v" name={name} radius={[8, 8, 0, 0]}>{data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer>);
}
export function PieShare({ data }: { data: { l: string; v: number }[] }) {
  return (<ResponsiveContainer width="100%" height={260}><PieChart><Pie data={data} dataKey="v" nameKey="l" innerRadius={55} outerRadius={90} paddingAngle={2}>{data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} /></PieChart></ResponsiveContainer>);
}
