'use client';

import '@xyflow/react/dist/style.css';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    Node,
    BackgroundVariant,
} from '@xyflow/react';
import { MessageSquare, Zap, GitBranch, Sparkles, Save, Play, Loader2, Send, Lock, Wrench, Route } from 'lucide-react';
import React, { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { useSubscription } from '@/features/billing';
import { TriggerNode, ActionNode, LogicNode, AINode, SkillNode, AIRouterNode } from '@/features/flows/components/CustomNodes';
import { useTemplates } from '@/features/messages/hooks/useTemplates';
import { validateFlow } from '../utils/validation';
import { api } from '@/lib/api/client';
import { getIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { useOmnichannelStore } from '@/stores/useOmnichannelStore';

const initialNodes: Node[] = [
    {
        id: '1',
        position: { x: 250, y: 50 },
        data: { keyword: 'hello', executing: false },
        type: 'trigger'
    },
    {
        id: '2',
        position: { x: 250, y: 250 },
        data: { message: 'Hello! How can I help you today?', executing: false },
        type: 'action'
    },
];

const initialEdges: Edge[] = [{ id: 'e1-2', source: '1', target: '2' }];

const nodeTypes = {
    trigger: TriggerNode,
    action: ActionNode,
    logic: LogicNode,
    ai: AINode,
    skill: SkillNode,
    ai_router: AIRouterNode,
};

/**
 * FlowsDashboard Component
 * Core business logic and UI for the Flow Builder.
 * Adheres to DeXMart 2026 Rule 8.1 (Thin Page) and Rule 181 (Emoji-Free).
 */
export function FlowsDashboard(): React.JSX.Element {
    const { data: templates } = useTemplates();
    const { subscription, isLoading: isLoadingPlan } = useSubscription();
    const { skills: rawSkills, fetchSkills } = useOmnichannelStore();
    const skills = rawSkills as { id?: string; name?: string; requiredTier?: string; parameters?: { properties?: Record<string, Record<string, string>> } }[];

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testInput, setTestInput] = useState('');
    const [testLogs, setTestLogs] = useState<string[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    const isProFeatureOpen = subscription?.plan !== 'starter';
    const userTier = subscription?.plan || 'starter';

    // Load existing flows and skills on mount
    React.useEffect(() => {
        if (!isProFeatureOpen) return;
        fetchSkills();
        const loadFlows = async (): Promise<void> => {
            try {
                const response = await api.get<{ nodes: Node[]; edges: Edge[] }[]>('/api/flows');
                if (response.success && Array.isArray(response.data) && response.data.length > 0) {
                    const flow = response.data[0]!;
                    if (flow.nodes && flow.nodes.length > 0) {
                        setNodes(flow.nodes);
                        setEdges(flow.edges || []);
                    } else {
                        setNodes([]);
                        setEdges([]);
                    }
                } else {
                    setNodes([]);
                    setEdges([]);
                }
            } catch {
                toast.error('Failed to load flows');
                setNodes([]);
                setEdges([]);
            }
        };
        loadFlows();
    }, [isProFeatureOpen, setNodes, setEdges, fetchSkills]);

    const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId), [nodes, selectedNodeId]);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    );

    const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
        setSelectedNodeId(node.id);
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNodeId(null);
    }, []);

    const updateNodeData = useCallback((nodeId: string, newData: Record<string, unknown>) => {
        setNodes((nds) => nds.map((node) => {
            if (node.id === nodeId) {
                return { ...node, data: { ...node.data, ...newData } };
            }
            return node;
        }));
    }, [setNodes]);

    const onSave = useCallback(async () => {
        const errors = validateFlow(nodes);
        if (errors.length > 0 && errors[0]) {
            toast.error(errors[0].message);
            return;
        }

        setIsSaving(true);
        try {
            const response = await api.post('/api/flows', {
                name: 'New Flow ' + new Date().toLocaleDateString(),
                nodes,
                edges,
                isActive: true
            });

            if (response.success) {
                toast.success('Flow saved successfully');
            } else {
                toast.error(response.error?.message || 'Failed to save flow');
            }
        } catch {
            toast.error('Network error while saving flow');
        } finally {
            setIsSaving(false);
        }
    }, [nodes, edges]);

    const runTest = async (): Promise<void> => {
        if (!testInput.trim()) return;

        setTestLogs([`User: ${testInput}`]);

        const trigger = nodes.find(n => n.type === 'trigger' && (n.data as Record<string, unknown>).keyword?.toString().toLowerCase() === testInput.toLowerCase());

        if (!trigger) {
            setTestLogs(prev => [...prev, "System: No matching trigger found."]);
            return;
        }

        setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, executing: false } })));

        const currentNodeId = trigger.id;
        await executeSimulationStep(currentNodeId);
    };

    const executeSimulationStep = async (nodeId: string): Promise<void> => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, executing: true } } : n));

        const nodeData = node.data as Record<string, unknown>;
        if (node.type === 'action') {
            setTestLogs(prev => [...prev, `Bot: ${nodeData.message || '(Empty Message)'}`]);
        } else if (node.type === 'trigger') {
            setTestLogs(prev => [...prev, `System: Trigger matched [${nodeData.keyword}]`]);
        } else if (node.type === 'skill') {
            setTestLogs(prev => [...prev, `System: Executing skill [${nodeData.skillName}]`]);
        }

        await new Promise(r => setTimeout(r, 1000));

        const outboundEdges = edges.filter(e => e.source === nodeId);
        for (const edge of outboundEdges) {
            setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, executing: false } } : n));
            await executeSimulationStep(edge.target);
        }

        setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, executing: false } } : n));
    };

    const onDragStart = (event: React.DragEvent, nodeType: string): void => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');

            if (typeof type === 'undefined' || !type) {
                return;
            }

            const position = { x: event.clientX - 400, y: event.clientY - 200 };
            const newNode = {
                id: `node_${Date.now()}`,
                type,
                position,
                data: { label: `${type} node`, executing: false },
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [setNodes],
    );

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    if (isLoadingPlan) {
        return (
            <div className="flex h-[calc(100vh-120px)] w-full items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!isProFeatureOpen) {
        return (
            <div className="flex flex-col h-[calc(100vh-120px)] w-full items-center justify-center bg-card/10 backdrop-blur-sm border border-border/40 rounded-xl p-8 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80 pointer-events-none" />
                <div className="relative z-10 flex flex-col items-center max-w-md mx-auto space-y-6">
                    <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center ring-4 ring-primary/5">
                        <Lock className="w-8 h-8 text-primary" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black tracking-tight">Pro Feature</h2>
                        <p className="text-muted-foreground">
                            The Agentic Flow Builder is a premium feature. Upgrade your workspace to build automated conversation flows and AI-driven logic.
                        </p>
                    </div>
                    <Button size="lg" className="w-full font-bold shadow-lg shadow-primary/25" onClick={() => window.location.href = '/dashboard/settings?tab=billing'}>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Upgrade to Pro
                    </Button>
                </div>
            </div>
        );
    }

    interface NodeData {
        keyword?: string;
        templateId?: string;
        message?: string;
        condition?: string;
        skillName?: string;
        nesting?: boolean;
        params?: Record<string, string>;
    }
    const nodeData = (selectedNode?.data ?? {}) as NodeData;
    const selectedSkill = skills.find(s => s.id === nodeData.skillName);

    return (
        <div className="flex h-[calc(100vh-120px)] w-full gap-4 overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 border border-border/40 rounded-xl bg-card/30 backdrop-blur-md p-4 flex flex-col gap-4">
                <div>
                    <h2 className="text-xs font-black uppercase tracking-tighter text-muted-foreground mb-4">Node Palette</h2>
                    <div className="space-y-2 h-[450px] overflow-y-auto pr-1 custom-scrollbar">
                        <div
                            className="p-3 rounded-lg border border-border/40 bg-background/50 cursor-grab hover:border-green-500/50 transition-colors flex items-center gap-3 group"
                            onDragStart={(e) => onDragStart(e, 'trigger')}
                            draggable
                        >
                            <div className="p-1.5 rounded-md bg-green-500/10 text-green-500">
                                <Zap className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-tight group-hover:text-green-500 transition-colors">Trigger</span>
                        </div>

                        <div
                            className="p-3 rounded-lg border border-border/40 bg-background/50 cursor-grab hover:border-blue-500/50 transition-colors flex items-center gap-3 group"
                            onDragStart={(e) => onDragStart(e, 'action')}
                            draggable
                        >
                            <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500">
                                <MessageSquare className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-tight group-hover:text-blue-500 transition-colors">Action</span>
                        </div>

                        <div
                            className="p-3 rounded-lg border border-border/40 bg-background/50 cursor-grab hover:border-amber-500/50 transition-colors flex items-center gap-3 group"
                            onDragStart={(e) => onDragStart(e, 'logic')}
                            draggable
                        >
                            <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-500">
                                <GitBranch className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-tight group-hover:text-amber-500 transition-colors">Logic</span>
                        </div>

                        <div
                            className="p-3 rounded-lg border border-border/40 bg-background/50 cursor-grab hover:border-purple-500/50 transition-colors flex items-center gap-3 group"
                            onDragStart={(e) => onDragStart(e, 'ai')}
                            draggable
                        >
                            <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-500">
                                <Sparkles className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-tight group-hover:text-purple-500 transition-colors">Gemini AI</span>
                        </div>

                        <div
                            className="p-3 rounded-lg border border-border/40 bg-background/50 cursor-grab hover:border-sky-500/50 transition-colors flex items-center gap-3 group"
                            onDragStart={(e) => onDragStart(e, 'skill')}
                            draggable
                        >
                            <div className="p-1.5 rounded-md bg-sky-500/10 text-sky-500">
                                <Wrench className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-tight group-hover:text-sky-500 transition-colors">Execute Skill</span>
                        </div>

                        <div
                            className="p-3 rounded-lg border border-border/40 bg-background/50 cursor-grab hover:border-orange-500/50 transition-colors flex items-center gap-3 group"
                            onDragStart={(e) => onDragStart(e, 'ai_router')}
                            draggable
                        >
                            <div className="p-1.5 rounded-md bg-orange-500/10 text-orange-500">
                                <Route className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-tight group-hover:text-orange-500 transition-colors">AI Router</span>
                        </div>
                    </div>
                </div>

                <div className="mt-auto space-y-2">
                    <button
                        className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        onClick={onSave}
                        disabled={isSaving}
                    >
                        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save Flow
                    </button>
                    <button
                        className="w-full py-2.5 bg-muted text-muted-foreground rounded-lg font-bold text-[10px] uppercase tracking-widest border border-border/40 hover:bg-muted/80 transition-all flex items-center justify-center gap-2"
                        onClick={() => setIsTesting(true)}
                    >
                        <Play className="w-3.5 h-3.5" /> Test Flow
                    </button>
                </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 border border-border/40 rounded-xl overflow-hidden bg-background/50 backdrop-blur-xl relative" onDrop={onDrop} onDragOver={onDragOver}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={onNodeClick}
                    onPaneClick={onPaneClick}
                    nodeTypes={nodeTypes}
                    fitView
                    colorMode="dark"
                >
                    <Controls />
                    <MiniMap zoomable pannable />
                    <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
                </ReactFlow>
            </div>

            {/* Properties Panel */}
            {selectedNode ? <div className="w-80 border border-border/40 rounded-xl bg-card/30 backdrop-blur-md p-4 flex flex-col gap-6 animate-in slide-in-from-right duration-300 overflow-y-auto">
                    <div>
                        <h2 className="text-xs font-black uppercase tracking-tighter text-primary mb-4">Node Properties</h2>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Node ID</label>
                                <div className="text-xs font-mono p-2 bg-muted/30 rounded border border-border/20">{selectedNode.id}</div>
                            </div>

                            {selectedNode.type === 'trigger' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Keyword Match</label>
                                    <Input
                                        value={nodeData.keyword || ''}
                                        onChange={(e) => updateNodeData(selectedNode.id, { keyword: e.target.value })}
                                        placeholder="e.g. hello"
                                    />
                                </div>
                            )}

                            {selectedNode.type === 'action' && (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Select Template</label>
                                        <Select
                                            value={nodeData.templateId || 'none'}
                                            onValueChange={(val) => {
                                                const tpl = templates?.find(t => t.id === val);
                                                updateNodeData(selectedNode.id, {
                                                    templateId: val === 'none' ? null : val,
                                                    templateName: tpl?.name || null
                                                });
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Choose a template" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">No Template (Use Raw Message)</SelectItem>
                                                {templates?.map(t => (
                                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {!nodeData.templateId && (
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase text-muted-foreground">Raw Message</label>
                                            <textarea
                                                className="w-full h-24 p-3 rounded-lg bg-muted/30 border border-border/20 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                                value={nodeData.message || ''}
                                                onChange={(e) => updateNodeData(selectedNode.id, { message: e.target.value })}
                                                placeholder="Type your message..."
                                            />
                                        </div>
                                    )}
                                </>
                            )}

                            {selectedNode.type === 'logic' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Condition</label>
                                    <Select
                                        value={nodeData.condition || 'is_premium'}
                                        onValueChange={(val) => updateNodeData(selectedNode.id, { condition: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="is_premium">User is Premium</SelectItem>
                                            <SelectItem value="has_tag">User has Tag</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {selectedNode.type === 'skill' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground">OpenClaw Skill</label>
                                        <Select
                                            value={nodeData.skillName || ''}
                                            onValueChange={(val) => {
                                                updateNodeData(selectedNode.id, {
                                                    skillName: val,
                                                    params: {} // Reset params on skill change
                                                });
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a skill..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {skills.map(skill => {
                                                    const isLocked = skill.requiredTier === 'enterprise' ? userTier !== 'enterprise' :
                                                        skill.requiredTier === 'pro' ? (userTier !== 'pro' && userTier !== 'enterprise') : false;

                                                    return (
                                                        <SelectItem key={skill.id} value={skill.id ?? ''} disabled={isLocked}>
                                                            <div className="flex items-center gap-2">
                                                                {getIcon(skill.id)}
                                                                <span className="truncate">{skill.name}</span>
                                                                {isLocked ? <Lock className="w-3 h-3 ml-auto text-muted-foreground" /> : null}
                                                            </div>
                                                        </SelectItem>
                                                    );
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {selectedSkill ? <div className="space-y-4 pt-4 border-t border-border/20">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[10px] font-bold uppercase">Deep Reasoning (Nesting)</Label>
                                                <input
                                                    type="checkbox"
                                                    className="h-3 w-3 rounded border-gray-300 text-primary focus:ring-primary"
                                                    checked={nodeData.nesting || false}
                                                    onChange={(e) => updateNodeData(selectedNode.id, { nesting: e.target.checked })}
                                                />
                                            </div>
                                            <p className="text-[9px] text-muted-foreground leading-tight">Enable autonomous sub-agent research and fact-checking for this node.</p>

                                            <h3 className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">Parameters</h3>
                                            {Object.entries(selectedSkill.parameters?.properties || {}).map(([key, prop]: [string, Record<string, string>]) => (
                                                <div key={key} className="space-y-1.5">
                                                    <Label className="text-[10px] font-bold uppercase">{prop.title || key}</Label>
                                                    <Input
                                                        placeholder={prop.description || ''}
                                                        value={(nodeData.params as Record<string, string> | undefined)?.[key] || ''}
                                                        onChange={(e) => {
                                                            const currentParams = nodeData.params || {};
                                                            updateNodeData(selectedNode.id, {
                                                                params: { ...(currentParams as Record<string, unknown>), [key]: e.target.value }
                                                            });
                                                        }}
                                                    />
                                                    {prop.description ? <p className="text-[9px] text-muted-foreground leading-tight">{prop.description}</p> : null}
                                                </div>
                                            ))}
                                            {Object.keys(selectedSkill.parameters?.properties || {}).length === 0 && (
                                                <p className="text-[10px] text-muted-foreground italic">No parameters required for this skill.</p>
                                            )}
                                        </div> : null}
                                </div>
                            )}
                        </div>
                    </div>
                </div> : null}

            {/* Test Flow Modal */}
            <Dialog open={isTesting} onOpenChange={setIsTesting}>
                <DialogContent className="sm:max-w-[500px] border-border/40 bg-card/90 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle>Simulator: Test Your Flow</DialogTitle>
                        <DialogDescription>
                            Type a message to see how your flow handles it in real-time.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-4 py-4">
                        <div className="h-[250px] w-full rounded-xl bg-background/50 border border-border/20 p-4 font-mono text-xs overflow-y-auto space-y-2">
                            {testLogs.length === 0 && <p className="text-muted-foreground italic">No simulation logs yet...</p>}
                            {testLogs.map((log, i) => (
                                <p key={i} className={cn(
                                    log.startsWith('User:') ? "text-primary" :
                                        log.startsWith('Bot:') ? "text-green-500 font-bold" :
                                            "text-muted-foreground"
                                )}>
                                    {log}
                                </p>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <Input
                                placeholder="Type a message (e.g. 'hello')"
                                value={testInput}
                                onChange={(e) => setTestInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && runTest()}
                            />
                            <button
                                onClick={runTest}
                                className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <DialogFooter>
                        <button
                            onClick={() => {
                                setIsTesting(false);
                                setTestLogs([]);
                                setTestInput('');
                                setNodes(nds => nds.map(n => ({ ...n, data: { ...(n.data as Record<string, unknown>), executing: false } })));
                            }}
                            className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
                        >
                            Close Simulator
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
