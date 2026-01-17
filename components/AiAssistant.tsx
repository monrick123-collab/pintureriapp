
import React, { useState, useEffect, useRef } from 'react';
import { AiService } from '../services/aiService';
import { InventoryService } from '../services/inventoryService';
import { Product } from '../types';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: Date;
}

const AiAssistant: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            text: '¡Hola! Soy tu asistente Pintamax. Pregúntame sobre inventario, recomendaciones técnicas o análisis de ventas.',
            timestamp: new Date()
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [apiKeyMissing, setApiKeyMissing] = useState(!AiService.hasApiKey());
    const [tempKey, setTempKey] = useState('');

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSaveKey = () => {
        if (tempKey.trim().length > 10) {
            AiService.setApiKey(tempKey);
            setApiKeyMissing(false);
        }
    };

    const handleSend = async () => {
        if (!inputValue.trim() || isLoading) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            text: inputValue,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsLoading(true);

        try {
            const products = await InventoryService.getProductsByBranch('ALL');

            // Get user from localStorage to pass the role
            const savedUser = localStorage.getItem('pintamax_user');
            const currentUser = savedUser ? JSON.parse(savedUser) : null;

            const responseText = await AiService.sendMessage(userMsg.text, {
                products,
                branchId: 'BR-MAIN', // TODO: Get dynamic branch ID
                userRole: currentUser?.role || 'POS'
            });

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: responseText,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: 'Error de conexión con el cerebro de IA.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Floating Action Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-6 right-6 z-[60] p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 ${isOpen ? 'bg-slate-800 rotate-90' : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-pulse-slow'
                    }`}
            >
                {isOpen ? (
                    <span className="material-symbols-outlined text-white text-xl">close</span>
                ) : (
                    <span className="material-symbols-outlined text-white text-2xl">auto_awesome</span> // 'sparkles' equivalent
                )}
            </button>

            {/* Chat Window */}
            <div
                className={`fixed bottom-24 right-6 w-96 max-w-[calc(100vw-3rem)] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 z-[60] overflow-hidden transition-all duration-300 origin-bottom-right flex flex-col ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'
                    }`}
                style={{ height: '600px', maxHeight: '70vh' }}
            >
                {/* Header */}
                <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center gap-3 shrink-0">
                    <div className="bg-white/20 p-2 rounded-xl">
                        <span className="material-symbols-outlined text-white">smart_toy</span>
                    </div>
                    <div>
                        <h3 className="font-black text-white text-sm">Asistente Pintamax</h3>
                        <p className="text-[10px] text-white/80 font-bold uppercase tracking-wider">Powered by Gemini 1.5</p>
                    </div>
                </div>

                {/* Configuration Overlay if no API Key */}
                {apiKeyMissing ? (
                    <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-4">
                        <span className="material-symbols-outlined text-6xl text-slate-300">key_off</span>
                        <h4 className="font-black text-slate-700 dark:text-white">Falta API Key</h4>
                        <p className="text-xs text-slate-500">Para usar el asistente, necesitas una API Key de Gemini (Google AI Studio).</p>
                        <input
                            type="password"
                            placeholder="Pegar API Key aquí..."
                            className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-mono border dark:border-slate-700"
                            value={tempKey}
                            onChange={e => setTempKey(e.target.value)}
                        />
                        <button
                            onClick={handleSaveKey}
                            className="w-full py-3 bg-indigo-500 text-white font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-indigo-600 transition-colors"
                        >
                            Guardar y Activar
                        </button>
                        <p className="text-[10px] text-slate-400">La clave se guarda localmente en tu navegador.</p>
                    </div>
                ) : (
                    <>
                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950/50 custom-scrollbar">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-3 rounded-2xl text-xs font-medium leading-relaxed ${msg.role === 'user'
                                        ? 'bg-indigo-500 text-white rounded-br-none'
                                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-bl-none shadow-sm'
                                        }`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-bl-none border border-slate-200 dark:border-slate-700 shadow-sm flex gap-1">
                                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-3 bg-white dark:bg-slate-900 border-t dark:border-slate-800 shrink-0">
                            <form
                                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                                className="flex gap-2"
                            >
                                <input
                                    className="flex-1 bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Escribe tu consulta..."
                                    value={inputValue}
                                    onChange={e => setInputValue(e.target.value)}
                                    disabled={isLoading}
                                />
                                <button
                                    type="submit"
                                    disabled={!inputValue.trim() || isLoading}
                                    className="bg-indigo-500 text-white p-3 rounded-xl disabled:opacity-50 hover:bg-indigo-600 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">send</span>
                                </button>
                            </form>
                        </div>
                    </>
                )}
            </div>
        </>
    );
};

export default AiAssistant;
