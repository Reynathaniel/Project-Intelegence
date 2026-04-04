import { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot, updateDoc, doc, handleFirestoreError, OperationType } from '../firebase';
import { Bell, X, Check, Trash2, AlertCircle, Info, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Notification {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  message: string;
  type: 'DeletionRequest' | 'Approval' | 'Rejection' | 'MaterialRequest' | 'alert' | 'ReportDeleted';
  read: boolean;
  createdAt: any;
}

interface NotificationBellProps {
  userId: string;
}

export default function NotificationBell({ userId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'qcNotifications'),
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setNotifications(list.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'qcNotifications');
    });

    return () => unsubscribe();
  }, [userId]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'qcNotifications', id), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `qcNotifications/${id}`);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(unread.map(n => updateDoc(doc(db, 'qcNotifications', n.id), { read: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'ReportDeleted': return <Trash2 className="w-4 h-4 text-red-500" />;
      case 'Approval': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'Rejection': return <X className="w-4 h-4 text-red-500" />;
      case 'alert': return <AlertCircle className="w-4 h-4 text-orange-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-all"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-neutral-900">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-neutral-800 bg-neutral-950/50 flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-widest">Intelligence Feed</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 uppercase tracking-tight"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="w-8 h-8 text-neutral-700 mx-auto mb-2 opacity-20" />
                    <p className="text-[10px] text-neutral-500 uppercase font-mono tracking-widest">No new intelligence</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markAsRead(n.id)}
                      className={`p-4 border-b border-neutral-800/50 cursor-pointer transition-colors ${
                        !n.read ? 'bg-emerald-500/5' : 'hover:bg-neutral-800/50'
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className={`p-2 rounded-lg flex-shrink-0 ${
                          !n.read ? 'bg-neutral-800' : 'bg-neutral-900'
                        }`}>
                          {getIcon(n.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className={`text-xs font-bold truncate ${!n.read ? 'text-white' : 'text-neutral-400'}`}>
                              {n.title}
                            </p>
                            {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                          </div>
                          <p className="text-[11px] text-neutral-500 leading-relaxed line-clamp-2">
                            {n.message}
                          </p>
                          <p className="text-[9px] text-neutral-600 mt-2 font-mono">
                            {n.createdAt?.toDate().toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
