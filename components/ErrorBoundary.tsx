
import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
                    <div className="bg-slate-900 border border-rose-500/30 rounded-[3rem] p-12 max-w-2xl w-full text-center shadow-2xl">
                        <div className="w-24 h-24 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-rose-500/20">
                            <span className="text-5xl">⚠️</span>
                        </div>
                        <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-4">
                            Hemos detectado una anomalía
                        </h1>
                        <p className="text-slate-400 mb-8 leading-relaxed">
                            La aplicación ha encontrado un error inesperado. Hemos blindado el sistema para proteger tus datos.
                            Por favor, intenta recargar la página.
                        </p>
                        {this.state.error && (
                            <div className="bg-black/40 rounded-2xl p-4 text-left mb-8 overflow-auto max-h-40">
                                <code className="text-rose-400 text-xs font-mono">
                                    {this.state.error.toString()}
                                </code>
                            </div>
                        )}
                        <button
                            onClick={() => window.location.reload()}
                            className="px-10 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-2xl transition-all uppercase tracking-widest shadow-xl"
                        >
                            🔄 Recargar Sistema
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
