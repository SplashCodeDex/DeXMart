'use client';

import {
    Activity,
    Zap,
    Clock,
    Network,
    Server,
    TrendingUp
} from 'lucide-react';
import React from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useOmnichannelStore } from '@/stores/useOmnichannelStore';

interface GatewayHealthData {
    uptimeMs?: number;
    agents?: unknown[];
    snapshot?: { presenceCount?: number };
}

export function GatewayMetrics(): React.JSX.Element {
    const { gatewayHealth, skillReport, getSkillCount, usageDaily } = useOmnichannelStore();
    const health = gatewayHealth as GatewayHealthData | null | undefined;

    const uptime = health?.uptimeMs || 0;
    const hours = Math.floor(uptime / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);
    
    const activeAgents = health?.agents?.length || 0;
    const totalSkills = getSkillCount();
    const presenceCount = health?.snapshot?.presenceCount || 0;

    // Use usageDaily for the chart, or sample data if empty
    const chartData = usageDaily.length > 0 
        ? usageDaily.slice(-7).map(d => ({
            name: d.date.split('T')[0],
            tokens: d.tokens
        }))
        : [
            { name: "Mon", tokens: 4000 },
            { name: "Tue", tokens: 3000 },
            { name: "Wed", tokens: 2000 },
            { name: "Thu", tokens: 2780 },
            { name: "Fri", tokens: 1890 },
            { name: "Sat", tokens: 2390 },
            { name: "Sun", tokens: 3490 },
        ];

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card hoverable className="border-border/40 bg-card/60 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Gateway Status</CardTitle>
                        <Activity className={cn(
                            "h-4 w-4",
                            uptime > 0 ? "text-green-500 animate-pulse" : "text-muted-foreground"
                        )} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{uptime > 0 ? 'OPERATIONAL' : 'OFFLINE'}</div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Uptime: {hours}h {minutes}m
                        </p>
                    </CardContent>
                </Card>

                <Card hoverable className="border-border/40 bg-card/60 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
                        <Server className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{activeAgents} INSTANCES</div>
                        <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${Math.min(activeAgents * 10, 100)}%` }} />
                        </div>
                    </CardContent>
                </Card>

                <Card hoverable className="border-border/40 bg-card/60 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Live Skills</CardTitle>
                        <Zap className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{totalSkills} TOOLS</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {skillReport?.skills?.filter(s => !s.disabled).length || 0} enabled globally
                        </p>
                    </CardContent>
                </Card>

                <Card hoverable className="border-border/40 bg-card/60 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Swarm Presence</CardTitle>
                        <Network className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{presenceCount} NODES</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Connected to the mesh
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center text-lg font-bold">
                        <TrendingUp className="mr-2 h-5 w-5 text-primary" />
                        System Throughput
                    </CardTitle>
                    <CardDescription>Aggregate token ingestion across the gateway fabric.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-primary-500)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--color-primary-500)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
                                <XAxis 
                                    dataKey="name" 
                                    tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis 
                                    tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "var(--color-card)",
                                        borderColor: "var(--color-border)",
                                        borderRadius: "0.5rem",
                                        fontSize: "10px",
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="tokens"
                                    stroke="var(--color-primary-500)"
                                    fillOpacity={1}
                                    fill="url(#colorTokens)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
