import { useState, useRef, useEffect, useMemo } from 'react';
import Webcam from 'react-webcam';
import { FirebaseUser, db, collection, addDoc, serverTimestamp, handleFirestoreError, OperationType, query, where, orderBy, limit, onSnapshot } from '../firebase';
import { UserProfile, Project, AttendanceRecord, AttendanceLocation, HRPersonnel } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, MapPin, CheckCircle2, Loader2, History, Clock, LogOut, X, AlertCircle, ShieldCheck, Info } from 'lucide-react';

interface GeneralManpowerDashboardProps {
  user: FirebaseUser;
  profile: UserProfile;
  project: Project | null;
}

export default function GeneralManpowerDashboard({ user, profile, project }: GeneralManpowerDashboardProps) {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [validLocations, setValidLocations] = useState<AttendanceLocation[]>([]);
  const [myManpowerProfile, setMyManpowerProfile] = useState<HRPersonnel | null>(null);
  const webcamRef = useRef<Webcam>(null);

  // Helper to calculate distance in meters
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Fetch valid locations for this project
  useEffect(() => {
    if (!project?.id) return;

    const q = query(
      collection(db, 'attendanceLocations'),
      where('projectId', '==', project.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const locs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceLocation));
      setValidLocations(locs);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'attendanceLocations');
    });

    return () => unsubscribe();
  }, [project?.id]);

  // Fetch my manpower profile for details
  useEffect(() => {
    if (!project?.id || !user.email) return;

    const q = query(
      collection(db, 'manpower'),
      where('projectId', '==', project.id),
      where('email', '==', user.email)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setMyManpowerProfile(snapshot.docs[0].data() as HRPersonnel);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'manpower');
    });

    return () => unsubscribe();
  }, [project?.id, user.email]);

  // Determine current valid location
  const currentValidLocation = useMemo(() => {
    if (!location || validLocations.length === 0 || !myManpowerProfile) return null;

    // Filter locations where user is allowed
    const allowedLocs = validLocations.filter(loc => 
      loc.allowedManpowerIds.length === 0 || 
      loc.allowedManpowerIds.includes(myManpowerProfile.manpowerId)
    );

    // Find the first location within radius
    return allowedLocs.find(loc => {
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        loc.latitude,
        loc.longitude
      );
      return distance <= loc.radius;
    });
  }, [location, validLocations, myManpowerProfile]);

  useEffect(() => {
    // Fetch attendance history
    const q = query(
      collection(db, 'attendance'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
      setHistory(records);
    }, (err) => {
      console.error('Error fetching history:', err);
    });

    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          setErrorMessage('Failed to get location. Please enable GPS.');
          setStatus('error');
        }
      );
    } else {
      setErrorMessage('Geolocation is not supported by this browser.');
      setStatus('error');
    }
  }, []);

  const capture = () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setPhoto(imageSrc);
      setIsCapturing(false);
    }
  };

  const handleSubmit = async (type: 'Check-in' | 'Check-out') => {
    if (!project) {
      setErrorMessage('Please select a project first.');
      setStatus('error');
      return;
    }
    if (!location) {
      setErrorMessage('Location not available. Please wait or enable GPS.');
      setStatus('error');
      return;
    }
    if (!photo) {
      setErrorMessage('Please capture a photo for verification.');
      setStatus('error');
      return;
    }
    if (!myManpowerProfile) {
      setErrorMessage('Manpower profile not found. Please contact HR to register your email.');
      setStatus('error');
      return;
    }
    if (!currentValidLocation) {
      setErrorMessage('You are not at a valid attendance location assigned to you.');
      setStatus('error');
      return;
    }

    setIsLoading(true);
    try {
      // Simple device fingerprint
      const deviceId = navigator.userAgent + '_' + (navigator.language || 'en');

      const record: Omit<AttendanceRecord, 'id'> = {
        userId: user.uid,
        userName: profile.name,
        projectId: project.id,
        projectName: project.name,
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        location,
        photo,
        type,
        locationId: currentValidLocation.id,
        locationName: currentValidLocation.name,
        deviceId,
        manpowerDetails: {
          position: myManpowerProfile.position,
          email: myManpowerProfile.email,
          classification: myManpowerProfile.classification
        }
      };

      await addDoc(collection(db, 'attendance'), {
        ...record,
        createdAt: serverTimestamp(),
      });

      setStatus('success');
      setPhoto(null);
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'attendance');
      setErrorMessage('Failed to submit attendance.');
      setStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Attendance</h2>
          <p className="text-neutral-500 text-sm">Clock-in/out with location and photo verification.</p>
        </div>

        {/* Manpower Info */}
        {myManpowerProfile && (
          <div className="p-4 bg-neutral-800/50 rounded-2xl border border-neutral-700/50 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-neutral-700 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{myManpowerProfile.name}</p>
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest">{myManpowerProfile.position}</p>
            </div>
          </div>
        )}

        {/* Status Messages */}
        <AnimatePresence>
          {status === 'success' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 p-4 rounded-xl flex items-center gap-3"
            >
              <CheckCircle2 className="w-5 h-5" />
              <p className="text-sm font-bold">Attendance submitted successfully!</p>
            </motion.div>
          )}
          {status === 'error' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm font-bold">{errorMessage}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Camera Section */}
        <div className="relative aspect-square bg-neutral-950 rounded-2xl overflow-hidden border border-neutral-800">
          {isCapturing ? (
            <>
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                className="w-full h-full object-cover"
                videoConstraints={{ facingMode: 'user' }}
              />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                <button
                  onClick={capture}
                  className="w-16 h-16 bg-white rounded-full border-4 border-neutral-300 shadow-xl flex items-center justify-center"
                >
                  <div className="w-12 h-12 bg-emerald-500 rounded-full" />
                </button>
              </div>
            </>
          ) : photo ? (
            <>
              <img src={photo} alt="Verification" className="w-full h-full object-cover" />
              <button
                onClick={() => setPhoto(null)}
                className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-neutral-600">
              <Camera className="w-16 h-16" />
              <button
                onClick={() => setIsCapturing(true)}
                className="px-6 py-2 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all"
              >
                OPEN CAMERA
              </button>
            </div>
          )}
        </div>

        {/* Location Info */}
        <div className="flex items-center gap-3 p-4 bg-neutral-800/50 rounded-2xl border border-neutral-700/50">
          <MapPin className={`w-5 h-5 ${location ? 'text-emerald-500' : 'text-neutral-600'}`} />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-neutral-500 uppercase font-mono tracking-widest">Current Location</p>
            <p className="text-xs text-white truncate">
              {location ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}` : 'Detecting location...'}
            </p>
            {location && (
              <p className={`text-[9px] font-bold uppercase mt-1 ${currentValidLocation ? 'text-emerald-500' : 'text-red-500'}`}>
                {currentValidLocation ? `✓ AT ${currentValidLocation.name}` : '✗ NOT AT ASSIGNED LOCATION'}
              </p>
            )}
          </div>
          {!location && <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />}
        </div>

        {/* Anti-Proxy Note */}
        <div className="p-3 bg-neutral-800/30 rounded-xl border border-neutral-700/30 flex items-start gap-2">
          <Info className="w-4 h-4 text-neutral-500 mt-0.5" />
          <p className="text-[10px] text-neutral-500 leading-relaxed italic">
            Verification photo and GPS location are recorded to prevent proxy attendance. HR will audit these records regularly.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            disabled={isLoading || !location || !photo || !currentValidLocation}
            onClick={() => handleSubmit('Check-in')}
            className="flex flex-col items-center gap-2 p-6 bg-emerald-500 text-black rounded-3xl font-bold hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20"
          >
            <Clock className="w-6 h-6" />
            <span className="text-sm uppercase tracking-widest">Check In</span>
          </button>
          <button
            disabled={isLoading || !location || !photo || !currentValidLocation}
            onClick={() => handleSubmit('Check-out')}
            className="flex flex-col items-center gap-2 p-6 bg-neutral-800 text-white rounded-3xl font-bold hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-neutral-700"
          >
            <LogOut className="w-6 h-6" />
            <span className="text-sm uppercase tracking-widest">Check Out</span>
          </button>
        </div>
      </div>

      {/* History */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-neutral-500" />
            <h3 className="text-sm font-bold text-white uppercase tracking-tight">Recent Activity</h3>
          </div>
        </div>
        <div className="space-y-3">
          {history.length > 0 ? (
            history.map((record) => (
              <div key={record.id} className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-xl border border-neutral-700/50">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${record.type === 'Check-in' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'}`}>
                    {record.type === 'Check-in' ? <Clock className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{record.type}</p>
                    <p className="text-[10px] text-neutral-500">{new Date(record.timestamp).toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-neutral-400 font-mono truncate max-w-[100px]">{record.locationName || 'Project Area'}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-neutral-600 text-xs py-4 italic">No recent attendance records found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
