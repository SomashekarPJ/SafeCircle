import React, { useState, useEffect } from 'react';
import { generateWeeklyHealthReport } from '../services/aiService';
import { fetchWeeklyBehaviorSummary } from '../services/behaviorTrackingService';
import { WeeklyHealthReport, BehaviorSummary } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, TrendingUp, AlertTriangle, Lightbulb, UserRound, Copy, Check, Loader2, RefreshCw } from 'lucide-react';
import { addDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface WeeklyReportCardProps {
  userId: string;
}

export const WeeklyReportCard: React.FC<WeeklyReportCardProps> = ({ userId }) => {
  const [report, setReport] = useState<WeeklyHealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const fetchHistory = async () => {
    const q = query(
      collection(db, 'users', userId, 'weeklyReports'),
      orderBy('timestamp', 'desc'),
      limit(4)
    );
    const snapshot = await getDocs(q);
    setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => {
    fetchHistory();
  }, [userId]);

  const generateReport = async () => {
    setLoading(true);
    try {
      const summary = await fetchWeeklyBehaviorSummary(userId);
      if (!summary) {
        alert("Not enough behavioral data to generate a report yet. Please continue using the app for a few more days.");
        return;
      }
      
      const newReport = await generateWeeklyHealthReport(summary);
      setReport(newReport);
      
      // Save report
      await addDoc(collection(db, 'users', userId, 'weeklyReports'), {
        ...newReport,
        timestamp: new Date().toISOString()
      });
      fetchHistory();
    } catch (error) {
      console.error('[WeeklyReport] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (report?.doctorNotes) {
      navigator.clipboard.writeText(report.doctorNotes);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-serif font-bold text-olive-accent">Weekly Health Insights</h3>
        <button 
          onClick={generateReport}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 rounded-full bg-olive-accent text-white font-bold text-sm shadow-md disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span>Generate New Report</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {report && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[32px] p-8 shadow-xl border border-olive-accent/5 space-y-8"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Activity className="h-6 w-6 text-olive-accent" />
                <span className="text-xl font-bold">Overall Trend</span>
              </div>
              <div className={`px-4 py-1 rounded-full text-white font-bold text-sm ${
                report.overallTrend === 'stable' ? 'bg-green-500' :
                report.overallTrend === 'improving' ? 'bg-blue-500' : 'bg-orange-500'
              }`}>
                {report.overallTrend.toUpperCase()}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-green-600 font-bold">
                  <TrendingUp className="h-5 w-5" />
                  <h4>Positive Highlights</h4>
                </div>
                <ul className="space-y-2">
                  {report.highlights.map((h, i) => (
                    <li key={i} className="flex items-start space-x-2 text-soft-text">
                      <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {report.concerns.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 text-orange-600 font-bold">
                    <AlertTriangle className="h-5 w-5" />
                    <h4>Things to Watch</h4>
                  </div>
                  <ul className="space-y-2">
                    {report.concerns.map((c, i) => (
                      <li key={i} className="flex items-start space-x-2 text-soft-text">
                        <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-blue-600 font-bold">
                <Lightbulb className="h-5 w-5" />
                <h4>Recommendations</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {report.recommendations.map((r, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-blue-50 text-blue-900 text-sm font-medium">
                    {r}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 rounded-[24px] bg-warm-bg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-olive-accent font-bold">
                  <UserRound className="h-5 w-5" />
                  <h4>Doctor's Summary</h4>
                </div>
                <button 
                  onClick={copyToClipboard}
                  className="flex items-center space-x-2 text-xs font-bold text-olive-accent/60 hover:text-olive-accent transition-colors"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span>{copied ? 'Copied!' : 'Copy for Doctor'}</span>
                </button>
              </div>
              <p className="text-soft-text italic leading-relaxed">
                "{report.doctorNotes}"
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!report && history.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {history.map((h) => (
            <button 
              key={h.id}
              onClick={() => setReport(h)}
              className="p-6 rounded-[24px] bg-white shadow-sm border border-olive-accent/5 hover:bg-olive-accent/5 transition-all text-left"
            >
              <p className="text-xs font-bold text-soft-text/60 uppercase mb-1">{new Date(h.timestamp).toLocaleDateString()}</p>
              <p className="font-bold text-olive-accent">Weekly Report</p>
              <div className={`inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold text-white ${
                h.overallTrend === 'stable' ? 'bg-green-500' : 'bg-orange-500'
              }`}>
                {h.overallTrend}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
