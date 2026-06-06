'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

import { useAuthStore } from '@/features/auth/store';
import { useMastermindStore, MastermindEvent } from '@/stores/useMastermindStore';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

export const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
});

const useSocketContext = (): SocketContextType => useContext(SocketContext);

export function SocketProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<Socket | null>(null);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const addEvent = useMastermindStore((state) => state.addEvent);

    useEffect(() => {
        // Only connect when the user is authenticated.
        // The httpOnly session cookie (sent via withCredentials) provides the JWT
        // to the backend socket middleware — no need to pass the token explicitly.
        if (!isAuthenticated) return;

        // Avoid duplicate connections
        if (socketRef.current?.connected) return;

        const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

        const socketInstance = io(socketUrl, {
            path: '/api/socket',
            withCredentials: true,
            transports: ['websocket'],
            autoConnect: true,
        });

        socketRef.current = socketInstance;

        socketInstance.on('connect', () => {
            setSocket(socketInstance);
            setIsConnected(true);
        });

        socketInstance.on('disconnect', () => {
            setIsConnected(false);
        });

        socketInstance.on('connect_error', (error) => {
            console.error('[Socket] Connection error:', error);
        });

        // --- Mastermind Event Handling ---
        socketInstance.on('mastermind_event', (event: MastermindEvent) => {
            addEvent(event);

            if (event.type === 'reasoning:error') {
                toast.error(`Agent Error: ${event.error}`, {
                    description: `Agent ID: ${event.agentId}`
                });
            }
        });

        return () => {
            socketInstance.disconnect();
            socketRef.current = null;
            setSocket(null);
            setIsConnected(false);
        };
    }, [isAuthenticated, addEvent]);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
}
