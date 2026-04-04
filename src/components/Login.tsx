import { motion } from 'framer-motion';
import { Shield, LogIn, Loader2 } from 'lucide-react';

interface LoginProps {
  onLogin: () => void;
  isLoading: boolean;
}

export default function Login({ onLogin, isLoading }: LoginProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center justify-center min-h-[100dvh] bg-neutral-950 px-4"
    >
      <div className="w-full max-w-md p-8 border border-neutral-800 bg-neutral-900/50 backdrop-blur-xl rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="p-4 bg-emerald-500/10 rounded-full border border-emerald-500/20">
            <Shield className="w-12 h-12 text-emerald-500" />
          </div>
          
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
              REY-COMMAND
            </h1>
            <p className="text-neutral-400 font-mono text-sm uppercase tracking-widest">
              Project Control Nexus
            </p>
          </div>

          <div className="w-full h-px bg-neutral-800 my-4" />

          <p className="text-neutral-400 text-sm leading-relaxed">
            Welcome, Commander. Access the multi-project control center for planning, tracking, and reporting.
          </p>

          <button
            onClick={onLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white text-black font-bold rounded-xl hover:bg-emerald-500 hover:text-white transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            )}
            {isLoading ? 'AUTHENTICATING...' : 'AUTHENTICATE WITH GOOGLE'}
          </button>

          <p className="text-[10px] text-neutral-600 font-mono uppercase tracking-tighter mt-4">
            Authorized Personnel Only • Reynathaniel Dhika Anggara
          </p>
        </div>
      </div>
    </motion.div>
  );
}
