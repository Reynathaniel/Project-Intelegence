import React, { useState, useEffect, useMemo } from 'react';
import { db, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, handleFirestoreError, OperationType } from '../firebase';
import { Project, AttendanceRecord, AttendanceLocation, HRPersonnel, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Search, 
  Calendar, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  LogOut, 
  Filter,
  Camera,
  X,
  User,
  Plus,
  Trash2,
  Edit2,
  Save,
  Navigation,
  ShieldAlert,
  Mail,
  Briefcase,
  Tag
} from 'lucide-react';
import { format } from 'date-fns';

interface HRAttendanceProps {
  project: Project;
}

export default function HRAttendance({ project }: HRAttendanceProps) {
  const [activeTab, setActiveTab] = useState<'attendance' | 'locations'>('attendance');
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [locations, setLocations] = useState<AttendanceLocation[]>([]);
  const [manpower, setManpower] = useState<HRPersonnel[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Location Management State
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [editingLocation, setEditingLocation] = useState<AttendanceLocation | null>(null);
  const [isDeletingAttendance, setIsDeletingAttendance] = useState(false);
  const [attendanceToDelete, setAttendanceToDelete] = useState<{ id: string, type: string, userName: string } | null>(null);
  const [newLocation, setNewLocation] = useState<Partial<AttendanceLocation>>({
    name: '',
    latitude: 0,
    longitude: 0,
    radius: 50,
    allowedManpowerIds: []
  });

  useEffect(() => {
    if (!project.id) return;

    // Fetch Attendance
    const qAttendance = query(
      collection(db, 'attendance'),
      where('projectId', '==', project.id),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeAttendance = onSnapshot(qAttendance, (snapshot) => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
      setAttendance(records);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'attendance');
    });

    // Fetch Locations
    const qLocations = query(
      collection(db, 'attendanceLocations'),
      where('projectId', '==', project.id)
    );

    const unsubscribeLocations = onSnapshot(qLocations, (snapshot) => {
      const locs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceLocation));
      setLocations(locs);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'attendanceLocations');
    });

    // Fetch Manpower for details
    const qManpower = query(
      collection(db, 'manpower'),
      where('projectId', '==', project.id)
    );

    const unsubscribeManpower = onSnapshot(qManpower, (snapshot) => {
      const mp = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HRPersonnel));
      setManpower(mp);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'manpower');
    });

    // Fetch Users to map UID to Email
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const u = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      setUsers(u);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'users');
    });

    return () => {
      unsubscribeAttendance();
      unsubscribeLocations();
      unsubscribeManpower();
      unsubscribeUsers();
    };
  }, [project.id]);

  // Consolidate Attendance: One row per user per day
  const consolidatedAttendance = useMemo(() => {
    const filtered = attendance.filter(record => record.date === selectedDate);
    
    const userMap: Record<string, { 
      userId: string;
      userName: string;
      checkIn?: AttendanceRecord;
      checkOut?: AttendanceRecord;
      manpower?: HRPersonnel;
    }> = {};

    filtered.forEach(record => {
      if (!userMap[record.userId]) {
        const userProfile = users.find(u => u.id === record.userId);
        const userEmail = userProfile?.email || record.manpowerDetails?.email;

        userMap[record.userId] = { 
          userId: record.userId, 
          userName: record.userName,
          manpower: manpower.find(m => 
            m.manpowerId === record.userId || 
            (userEmail && m.email?.toLowerCase() === userEmail.toLowerCase())
          )
        };
      }
      
      if (record.type === 'Check-in') {
        if (!userMap[record.userId].checkIn || new Date(record.timestamp) < new Date(userMap[record.userId].checkIn!.timestamp)) {
          userMap[record.userId].checkIn = record;
        }
      } else {
        if (!userMap[record.userId].checkOut || new Date(record.timestamp) > new Date(userMap[record.userId].checkOut!.timestamp)) {
          userMap[record.userId].checkOut = record;
        }
      }
    });

    return Object.values(userMap).filter(entry => 
      entry.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.userId.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => a.userName.localeCompare(b.userName));
  }, [attendance, selectedDate, searchQuery, manpower, users]);

  const handleSaveLocation = async () => {
    if (!newLocation.name || newLocation.latitude === undefined || newLocation.longitude === undefined) return;

    try {
      const locationData = {
        name: newLocation.name,
        latitude: Number(newLocation.latitude),
        longitude: Number(newLocation.longitude),
        radius: Number(newLocation.radius || 50),
        allowedManpowerIds: newLocation.allowedManpowerIds || [],
        projectId: project.id
      };

      if (editingLocation) {
        await updateDoc(doc(db, 'attendanceLocations', editingLocation.id), locationData);
      } else {
        await addDoc(collection(db, 'attendanceLocations'), {
          ...locationData,
          createdAt: serverTimestamp()
        });
      }
      setIsAddingLocation(false);
      setEditingLocation(null);
      setNewLocation({ name: '', latitude: 0, longitude: 0, radius: 50, allowedManpowerIds: [] });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'attendanceLocations');
      console.error('Error saving location:', err);
    }
  };

  const handleDeleteLocation = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this location?')) {
      await deleteDoc(doc(db, 'attendanceLocations', id));
    }
  };

  const handleDeleteAttendance = async () => {
    if (!attendanceToDelete) return;
    try {
      await deleteDoc(doc(db, 'attendance', attendanceToDelete.id));
      setIsDeletingAttendance(false);
      setAttendanceToDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'attendance');
      console.error('Error deleting attendance:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('attendance')}
          className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'attendance' ? 'bg-emerald-500 text-black shadow-lg' : 'text-neutral-500 hover:text-white'
          }`}
        >
          Attendance List
        </button>
        <button 
          onClick={() => setActiveTab('locations')}
          className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'locations' ? 'bg-emerald-500 text-black shadow-lg' : 'text-neutral-500 hover:text-white'
          }`}
        >
          Location Management
        </button>
      </div>

      {activeTab === 'attendance' ? (
        <>
          {/* Filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-6 h-6 text-emerald-500" />
                Daftar Hadir Manpower
              </h2>
              <p className="text-xs text-neutral-500 uppercase tracking-widest">
                Project: {project.name}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input 
                  type="text"
                  placeholder="Cari Nama/ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white focus:border-emerald-500 transition-all outline-none w-48"
                />
              </div>

              <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2">
                <Calendar className="w-4 h-4 text-neutral-500" />
                <input 
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-xs text-white outline-none"
                />
              </div>
            </div>
          </div>

          {/* Attendance Table */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-bottom border-neutral-800 bg-neutral-800/30">
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Manpower Details</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Position & Classification</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Check-In</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Check-Out</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-center">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                          <p className="text-xs text-neutral-500 uppercase tracking-widest">Memuat data...</p>
                        </div>
                      </td>
                    </tr>
                  ) : consolidatedAttendance.length > 0 ? (
                    consolidatedAttendance.map((entry) => (
                      <tr key={entry.userId} className="hover:bg-neutral-800/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center border border-neutral-700">
                              <User className="w-5 h-5 text-neutral-500" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white">{entry.userName}</p>
                              <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                                <span className="font-mono uppercase">{entry.userId}</span>
                                <span className="w-1 h-1 rounded-full bg-neutral-700" />
                                <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {entry.manpower?.email || 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs text-neutral-300">
                              <Briefcase className="w-3 h-3 text-emerald-500" />
                              {entry.manpower?.position || entry.checkIn?.manpowerDetails?.position || 'N/A'}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-neutral-500 uppercase tracking-widest">
                              <Tag className="w-3 h-3" />
                              {entry.manpower?.classification || entry.checkIn?.manpowerDetails?.classification || 'N/A'}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {entry.checkIn ? (
                            <div className="space-y-1 relative group/item">
                              <div className="flex items-center gap-2 text-emerald-500 font-mono text-xs">
                                <Clock className="w-3 h-3" />
                                {format(new Date(entry.checkIn.timestamp), 'HH:mm:ss')}
                                <button 
                                  onClick={() => {
                                    setAttendanceToDelete({ id: entry.checkIn!.id, type: 'Check-in', userName: entry.userName });
                                    setIsDeletingAttendance(true);
                                  }}
                                  className="ml-auto opacity-0 group-hover/item:opacity-100 p-1 text-red-500 hover:bg-red-500/10 rounded transition-all"
                                  title="Hapus Check-in"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="flex items-center gap-1 text-[9px] text-neutral-500">
                                <MapPin className="w-2 h-2" />
                                {entry.checkIn.locationName || 'Project Area'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-neutral-600 italic">No Check-in</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {entry.checkOut ? (
                            <div className="space-y-1 relative group/item">
                              <div className="flex items-center gap-2 text-orange-500 font-mono text-xs">
                                <Clock className="w-3 h-3" />
                                {format(new Date(entry.checkOut.timestamp), 'HH:mm:ss')}
                                <button 
                                  onClick={() => {
                                    setAttendanceToDelete({ id: entry.checkOut!.id, type: 'Check-out', userName: entry.userName });
                                    setIsDeletingAttendance(true);
                                  }}
                                  className="ml-auto opacity-0 group-hover/item:opacity-100 p-1 text-red-500 hover:bg-red-500/10 rounded transition-all"
                                  title="Hapus Check-out"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="flex items-center gap-1 text-[9px] text-neutral-500">
                                <MapPin className="w-2 h-2" />
                                {entry.checkOut.locationName || 'Project Area'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-neutral-600 italic">No Check-out</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            {entry.checkIn && (
                              <button 
                                onClick={() => setSelectedPhoto(entry.checkIn!.photo)}
                                className="p-2 bg-neutral-800 rounded-lg hover:bg-neutral-700 transition-all text-emerald-500"
                                title="Check-in Photo"
                              >
                                <Camera className="w-4 h-4" />
                              </button>
                            )}
                            {entry.checkOut && (
                              <button 
                                onClick={() => setSelectedPhoto(entry.checkOut!.photo)}
                                className="p-2 bg-neutral-800 rounded-lg hover:bg-neutral-700 transition-all text-orange-500"
                                title="Check-out Photo"
                              >
                                <Camera className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3 opacity-20">
                          <Users className="w-12 h-12" />
                          <p className="text-xs uppercase tracking-widest">Tidak ada data absensi</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Navigation className="w-6 h-6 text-emerald-500" />
                Attendance Locations
              </h2>
              <p className="text-xs text-neutral-500 uppercase tracking-widest">Define valid geofences for attendance</p>
            </div>
            <button 
              onClick={() => setIsAddingLocation(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-black rounded-xl font-bold text-xs hover:bg-emerald-400 transition-all"
            >
              <Plus className="w-4 h-4" />
              ADD LOCATION
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {locations.map(loc => (
              <div key={loc.id} className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-4 relative group">
                <div className="flex items-start justify-between">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl">
                    <MapPin className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => {
                        setEditingLocation(loc);
                        setNewLocation(loc);
                        setIsAddingLocation(true);
                      }}
                      className="p-2 bg-neutral-800 text-neutral-400 hover:text-white rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteLocation(loc.id)}
                      className="p-2 bg-neutral-800 text-neutral-400 hover:text-red-500 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white">{loc.name}</h3>
                  <p className="text-xs text-neutral-500 font-mono">
                    {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500 uppercase tracking-widest">Radius</span>
                  <span className="text-emerald-500 font-bold">{loc.radius}m</span>
                </div>

                <div className="pt-4 border-t border-neutral-800">
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-2">Assigned Manpower</p>
                  <div className="flex flex-wrap gap-2">
                    {loc.allowedManpowerIds.length === 0 ? (
                      <span className="text-[10px] text-neutral-600 italic">All Manpower Allowed</span>
                    ) : (
                      loc.allowedManpowerIds.map(id => {
                        const person = manpower.find(m => m.manpowerId === id);
                        return (
                          <span key={id} className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded-lg text-[9px] text-neutral-400">
                            {person?.name || id}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attendance Deletion Confirmation Modal */}
      <AnimatePresence>
        {isDeletingAttendance && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 max-w-md w-full space-y-6"
            >
              <div className="flex items-center gap-4 text-red-500">
                <div className="p-3 bg-red-500/10 rounded-2xl">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Konfirmasi Hapus</h3>
                  <p className="text-xs text-neutral-500 uppercase tracking-widest">Tindakan ini tidak dapat dibatalkan</p>
                </div>
              </div>

              <div className="p-4 bg-neutral-800/50 rounded-2xl border border-neutral-700">
                <p className="text-sm text-neutral-300">
                  Apakah Anda yakin ingin menghapus data <span className="text-white font-bold">{attendanceToDelete?.type}</span> untuk <span className="text-white font-bold">{attendanceToDelete?.userName}</span>?
                </p>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDeletingAttendance(false)}
                  className="flex-1 px-6 py-3 bg-neutral-800 text-white rounded-2xl font-bold text-xs hover:bg-neutral-700 transition-all uppercase tracking-widest"
                >
                  Batal
                </button>
                <button 
                  onClick={handleDeleteAttendance}
                  className="flex-1 px-6 py-3 bg-red-500 text-white rounded-2xl font-bold text-xs hover:bg-red-600 transition-all uppercase tracking-widest shadow-lg shadow-red-500/20"
                >
                  Hapus Data
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Location Modal */}
      <AnimatePresence>
        {isAddingLocation && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">
                  {editingLocation ? 'Edit Location' : 'Add New Location'}
                </h3>
                <button onClick={() => setIsAddingLocation(false)} className="p-2 text-neutral-500 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Location Name</label>
                  <input 
                    type="text"
                    value={newLocation.name}
                    onChange={e => setNewLocation({...newLocation, name: e.target.value})}
                    placeholder="e.g., Main Gate, Warehouse A"
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Latitude</label>
                    <input 
                      type="number"
                      value={newLocation.latitude}
                      onChange={e => setNewLocation({...newLocation, latitude: parseFloat(e.target.value)})}
                      className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white focus:border-emerald-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Longitude</label>
                    <input 
                      type="number"
                      value={newLocation.longitude}
                      onChange={e => setNewLocation({...newLocation, longitude: parseFloat(e.target.value)})}
                      className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white focus:border-emerald-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Radius (Meters)</label>
                  <input 
                    type="number"
                    value={newLocation.radius}
                    onChange={e => setNewLocation({...newLocation, radius: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Assign Manpower (Optional)</label>
                  <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 max-h-48 overflow-y-auto space-y-2">
                    {manpower.map(person => (
                      <label key={person.manpowerId} className="flex items-center gap-3 cursor-pointer group">
                        <input 
                          type="checkbox"
                          checked={newLocation.allowedManpowerIds?.includes(person.manpowerId)}
                          onChange={e => {
                            const ids = newLocation.allowedManpowerIds || [];
                            if (e.target.checked) {
                              setNewLocation({...newLocation, allowedManpowerIds: [...ids, person.manpowerId]});
                            } else {
                              setNewLocation({...newLocation, allowedManpowerIds: ids.filter(id => id !== person.manpowerId)});
                            }
                          }}
                          className="w-4 h-4 rounded border-neutral-600 bg-neutral-700 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="text-xs text-neutral-400 group-hover:text-white transition-colors">
                          {person.name} <span className="text-[10px] text-neutral-600 font-mono">({person.manpowerId})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[9px] text-neutral-600 italic">If none selected, all manpower can use this location.</p>
                </div>
              </div>

              <div className="p-6 bg-neutral-800/50 border-t border-neutral-800 flex gap-3">
                <button 
                  onClick={() => setIsAddingLocation(false)}
                  className="flex-1 px-6 py-3 bg-neutral-800 text-white rounded-xl font-bold text-xs hover:bg-neutral-700 transition-all"
                >
                  CANCEL
                </button>
                <button 
                  onClick={handleSaveLocation}
                  className="flex-1 px-6 py-3 bg-emerald-500 text-black rounded-xl font-bold text-xs hover:bg-emerald-400 transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  SAVE LOCATION
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Photo Modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
            onClick={() => setSelectedPhoto(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-2xl w-full bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-all z-10"
              >
                <X className="w-5 h-5" />
              </button>
              <img src={selectedPhoto} alt="Attendance" className="w-full h-auto" />
              <div className="p-6 border-t border-neutral-800">
                <p className="text-xs text-neutral-500 uppercase tracking-widest text-center">Verification Photo</p>
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                  <p className="text-[10px] text-red-400 leading-relaxed">
                    <strong>Proxy Mitigation:</strong> Please verify that the person in the photo matches the manpower profile. Proxy attendance is strictly prohibited.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
