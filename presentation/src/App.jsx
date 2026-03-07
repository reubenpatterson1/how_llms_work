import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend } from 'recharts';

const SEVERITY_COLORS = {
  'Sev-1': '#ef4444',
  'Sev-2': '#f59e0b',
  'Sev-3': '#10b981',
  'Sev-4': '#6366f1',
  'Sev-5': '#8b5cf6'
};

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#ef4444'];

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 25;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null; // Hide labels for very small slices

  return (
    <text 
      x={x} 
      y={y} 
      fill="#94a3b8" 
      textAnchor={x > cx ? 'start' : 'end'} 
      dominantBaseline="central"
      fontSize="12"
      fontWeight="500"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const PercentageBar = ({ data, dataKey, total }) => {
  return data.map((entry, index) => {
    const percentage = ((entry[dataKey] / total) * 100).toFixed(0);
    return null; // We'll use this for the label
  });
};

const MetricCard = ({ title, value, subtitle, trend, unit = '' }) => (
  <div className="metric-card">
    <div className="metric-header">
      <span className="metric-title">{title}</span>
      {trend && (
        <span className={`metric-trend ${trend > 0 ? 'positive' : 'negative'}`}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </span>
      )}
    </div>
    <div className="metric-value">{value}{unit}</div>
    {subtitle && <div className="metric-subtitle">{subtitle}</div>}
  </div>
);

const StatRow = ({ label, avg, min, max, unit = '' }) => (
  <div className="stat-row">
    <span className="stat-label">{label}</span>
    <div className="stat-values">
      <span className="stat-item"><span className="stat-type">AVG</span> {avg.toFixed(1)}{unit}</span>
      <span className="stat-item"><span className="stat-type">MIN</span> {min}{unit}</span>
      <span className="stat-item"><span className="stat-type">MAX</span> {max}{unit}</span>
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="tooltip-label">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const LoadingSpinner = () => (
  <div className="loading-container">
    <div className="spinner"></div>
    <p>Loading incident data...</p>
  </div>
);

const ErrorMessage = ({ message, onRetry }) => (
  <div className="error-container">
    <div className="error-icon">⚠️</div>
    <h2>Unable to Load Data</h2>
    <p>{message}</p>
    <button onClick={onRetry} className="retry-button">Retry</button>
  </div>
);

const FileUploader = ({ onFileLoaded }) => {
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const processedData = results.data.map(row => ({
            ...row,
            MTTA: (parseFloat(row.MTTA) || 0) / 60,
            MTTI: (parseFloat(row.MTTI) || 0) / 60,
            MTTR: parseFloat(row.MTTR) || 0,
            OPE: parseFloat(row.OPE) || 0,
            'Shift Count': parseInt(row['Shift Count']) || 0,
            'Viewer Count': parseInt(row['Viewer Count']) || 0,
          }));
          onFileLoaded(processedData);
        },
        error: (error) => {
          console.error('CSV parsing error:', error);
        }
      });
    }
  };

  return (
    <div className="upload-container">
      <div className="upload-box">
        <div className="upload-icon">📊</div>
        <h2>Incident Analytics Dashboard</h2>
        <p>Upload your incident CSV file to generate the report</p>
        <label className="upload-button">
          <input type="file" accept=".csv" onChange={handleFileChange} />
          Select CSV File
        </label>
        <p className="upload-hint">
          Expected columns: Created, ID, Impact, Incident Type, MTTA, MTTI, MTTR, Members, OPE, Severity, Shift Count, Viewer Count
        </p>
      </div>
    </div>
  );
};

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadCSV = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/data/incidents.csv');
      if (!response.ok) {
        throw new Error('CSV file not found. Please upload a file.');
      }
      const csvText = await response.text();
      
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const processedData = results.data.map(row => ({
            ...row,
            MTTA: (parseFloat(row.MTTA) || 0) / 60,
            MTTI: (parseFloat(row.MTTI) || 0) / 60,
            MTTR: parseFloat(row.MTTR) || 0,
            OPE: parseFloat(row.OPE) || 0,
            'Shift Count': parseInt(row['Shift Count']) || 0,
            'Viewer Count': parseInt(row['Viewer Count']) || 0,
          }));
          setData(processedData);
          setLoading(false);
        },
        error: (error) => {
          setError('Failed to parse CSV file');
          setLoading(false);
        }
      });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCSV();
  }, []);

  const analytics = useMemo(() => {
    if (!data || data.length === 0) return null;

    const calc = (arr, key) => {
      const values = arr.map(d => d[key]).filter(v => typeof v === 'number' && !isNaN(v));
      if (values.length === 0) return { avg: 0, min: 0, max: 0 };
      return {
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values)
      };
    };

    // Severity distribution
    const severityCounts = data.reduce((acc, d) => {
      const sev = d.Severity || 'Unknown';
      acc[sev] = (acc[sev] || 0) + 1;
      return acc;
    }, {});
    const severityData = Object.entries(severityCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Incident type distribution
    const typeCounts = data.reduce((acc, d) => {
      const type = d['Incident Type'] || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    const typeData = Object.entries(typeCounts).map(([name, value]) => ({ name, value }));

    // Team member distribution
    const memberCounts = data.reduce((acc, d) => {
      const member = d.Members || 'Unassigned';
      acc[member] = (acc[member] || 0) + 1;
      return acc;
    }, {});
    const memberData = Object.entries(memberCounts)
      .map(([name, incidents]) => ({ name, incidents }))
      .sort((a, b) => b.incidents - a.incidents);

    // Time of day distribution
    const hourCounts = Array(24).fill(0);
    data.forEach(d => {
      try {
        const hour = new Date(d.Created).getHours();
        if (!isNaN(hour)) hourCounts[hour]++;
      } catch (e) {}
    });
    const hourData = hourCounts.map((count, hour) => ({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      incidents: count
    }));

    // Monthly trend
    const monthlyData = data.reduce((acc, d) => {
      try {
        const date = new Date(d.Created);
        if (isNaN(date.getTime())) return acc;
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        if (!acc[monthKey]) {
          acc[monthKey] = { month: monthKey, incidents: 0, totalMTTR: 0, totalMTTA: 0 };
        }
        acc[monthKey].incidents++;
        acc[monthKey].totalMTTR += d.MTTR || 0;
        acc[monthKey].totalMTTA += d.MTTA || 0;
      } catch (e) {}
      return acc;
    }, {});
    
    const monthlyTrend = Object.values(monthlyData)
      .map(m => ({
        ...m,
        avgMTTR: m.incidents > 0 ? m.totalMTTR / m.incidents : 0,
        avgMTTA: m.incidents > 0 ? m.totalMTTA / m.incidents : 0
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Impact distribution
    const impactCounts = data.reduce((acc, d) => {
      const impact = d.Impact || 'Unknown';
      acc[impact] = (acc[impact] || 0) + 1;
      return acc;
    }, {});
    const impactData = Object.entries(impactCounts).map(([name, value]) => ({ name, value }));

    // Day of week distribution
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayCounts = Array(7).fill(0);
    data.forEach(d => {
      try {
        const day = new Date(d.Created).getDay();
        if (!isNaN(day)) dayCounts[day]++;
      } catch (e) {}
    });
    const dayData = dayCounts.map((count, day) => ({
      day: dayNames[day],
      incidents: count
    }));

    return {
      total: data.length,
      mtta: calc(data, 'MTTA'),
      mtti: calc(data, 'MTTI'),
      mttr: calc(data, 'MTTR'),
      ope: calc(data, 'OPE'),
      shiftCount: calc(data, 'Shift Count'),
      viewerCount: calc(data, 'Viewer Count'),
      severityData,
      typeData,
      memberData,
      hourData,
      monthlyTrend,
      impactData,
      dayData
    };
  }, [data]);

  if (loading) {
    return (
      <>
        <style>{styles}</style>
        <LoadingSpinner />
      </>
    );
  }

  if (error) {
    return (
      <>
        <style>{styles}</style>
        <FileUploader onFileLoaded={(data) => { setData(data); setError(null); }} />
      </>
    );
  }

  if (!analytics) {
    return (
      <>
        <style>{styles}</style>
        <ErrorMessage message="No data available" onRetry={loadCSV} />
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      
      <div className="dashboard">
        <header className="dashboard-header">
          <h1 className="dashboard-title">Incident Analytics Report</h1>
          <p className="dashboard-subtitle">Comprehensive Performance & Reliability Metrics</p>
          <span className="dashboard-date">FY 2025 Annual Review • {analytics.total} Total Incidents</span>
        </header>
        
        <div className="metrics-grid">
          <MetricCard 
            title="Total Incidents" 
            value={analytics.total}
            subtitle="Year to date"
          />
          <MetricCard 
            title="Avg MTTR" 
            value={analytics.mttr.avg.toFixed(1)}
            unit=" min"
            subtitle="Mean Time to Resolve"
          />
          <MetricCard 
            title="Avg MTTA" 
            value={analytics.mtta.avg.toFixed(1)}
            unit=" min"
            subtitle="Mean Time to Acknowledge"
          />
          <MetricCard 
            title="Avg OPE Score" 
            value={analytics.ope.avg.toFixed(2)}
            subtitle="Operational Performance"
          />
        </div>
        
        <h2 className="section-title">Detailed Metrics Analysis</h2>
        <div className="stats-card">
          <StatRow label="Mean Time to Acknowledge (MTTA)" {...analytics.mtta} unit=" min" />
          <StatRow label="Mean Time to Identify (MTTI)" {...analytics.mtti} unit=" min" />
          <StatRow label="Mean Time to Resolve (MTTR)" {...analytics.mttr} unit=" min" />
          <StatRow label="Operational Performance (OPE)" {...analytics.ope} />
          <StatRow label="Shift Count" {...analytics.shiftCount} />
          <StatRow label="Viewer Count" {...analytics.viewerCount} />
        </div>
        
        <h2 className="section-title">Distribution Analysis</h2>
        <div className="charts-grid">
          <div className="chart-card">
            <h3 className="chart-title">Severity Distribution</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.severityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    label={renderCustomizedLabel}
                    labelLine={false}
                  >
                    {analytics.severityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={SEVERITY_COLORS[entry.name] || CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="legend-custom">
              {analytics.severityData.map((entry, index) => (
                <div key={entry.name} className="legend-item">
                  <span className="legend-dot" style={{ background: SEVERITY_COLORS[entry.name] || CHART_COLORS[index % CHART_COLORS.length] }} />
                  {entry.name}: {entry.value} ({((entry.value / analytics.total) * 100).toFixed(0)}%)
                </div>
              ))}
            </div>
          </div>
          
          <div className="chart-card">
            <h3 className="chart-title">Incident Type Distribution</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.typeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    label={renderCustomizedLabel}
                    labelLine={false}
                  >
                    {analytics.typeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="legend-custom">
              {analytics.typeData.map((entry, index) => (
                <div key={entry.name} className="legend-item">
                  <span className="legend-dot" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                  {entry.name}: {entry.value} ({((entry.value / analytics.total) * 100).toFixed(0)}%)
                </div>
              ))}
            </div>
          </div>
          
          <div className="chart-card">
            <h3 className="chart-title">Incidents by Team Member</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.memberData.map(d => ({...d, percentage: ((d.incidents / analytics.total) * 100).toFixed(0)}))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 12 }} width={80} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="custom-tooltip">
                            <p className="tooltip-label">{data.name}</p>
                            <p style={{ color: '#3b82f6' }}>Incidents: {data.incidents} ({data.percentage}%)</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="incidents" fill="#3b82f6" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#94a3b8', fontSize: 11, formatter: (val, entry) => `${((val / analytics.total) * 100).toFixed(0)}%` }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="chart-card">
            <h3 className="chart-title">Impact Distribution</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.impactData.map(d => ({...d, percentage: ((d.value / analytics.total) * 100).toFixed(0)}))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="custom-tooltip">
                            <p className="tooltip-label">{data.name}</p>
                            <p style={{ color: '#8b5cf6' }}>Count: {data.value} ({data.percentage}%)</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#94a3b8', fontSize: 11, formatter: (val) => `${((val / analytics.total) * 100).toFixed(0)}%` }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        
        <h2 className="section-title">Temporal Analysis</h2>
        <div className="charts-grid">
          <div className="chart-card full-width">
            <h3 className="chart-title">Monthly Incident Trend & Resolution Time</h3>
            <div className="chart-container tall">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.monthlyTrend}>
                  <defs>
                    <linearGradient id="colorIncidents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Area yAxisId="left" type="monotone" dataKey="incidents" stroke="#3b82f6" fillOpacity={1} fill="url(#colorIncidents)" name="Incidents" />
                  <Line yAxisId="right" type="monotone" dataKey="avgMTTR" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', strokeWidth: 2 }} name="Avg MTTR (min)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="chart-card">
            <h3 className="chart-title">Incidents by Hour of Day</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.hourData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 10 }} interval={2} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const percentage = analytics.total > 0 ? ((data.incidents / analytics.total) * 100).toFixed(0) : 0;
                        return (
                          <div className="custom-tooltip">
                            <p className="tooltip-label">{data.hour}</p>
                            <p style={{ color: '#14b8a6' }}>Incidents: {data.incidents} ({percentage}%)</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="incidents" fill="#14b8a6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="chart-card">
            <h3 className="chart-title">Incidents by Day of Week</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.dayData.map(d => ({...d, percentage: analytics.total > 0 ? ((d.incidents / analytics.total) * 100).toFixed(0) : 0}))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="custom-tooltip">
                            <p className="tooltip-label">{data.day}</p>
                            <p style={{ color: '#ec4899' }}>Incidents: {data.incidents} ({data.percentage}%)</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="incidents" fill="#ec4899" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#94a3b8', fontSize: 10, formatter: (val) => val > 0 ? `${((val / analytics.total) * 100).toFixed(0)}%` : '' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        
        <footer className="footer">
          <p>Generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} • Incident Management Dashboard</p>
        </footer>
      </div>
    </>
  );
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  body {
    background: #0f172a;
  }
  
  .dashboard {
    min-height: 100vh;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
    color: #e2e8f0;
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    padding: 32px;
  }
  
  .loading-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
    color: #94a3b8;
    font-family: 'DM Sans', sans-serif;
  }
  
  .spinner {
    width: 48px;
    height: 48px;
    border: 3px solid rgba(59, 130, 246, 0.2);
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .error-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
    color: #e2e8f0;
    font-family: 'DM Sans', sans-serif;
    text-align: center;
  }
  
  .error-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }
  
  .error-container h2 {
    margin-bottom: 8px;
  }
  
  .error-container p {
    color: #94a3b8;
    margin-bottom: 24px;
  }
  
  .retry-button {
    background: #3b82f6;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .retry-button:hover {
    background: #2563eb;
  }
  
  .upload-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
    font-family: 'DM Sans', sans-serif;
    padding: 20px;
  }
  
  .upload-box {
    background: rgba(30, 41, 59, 0.8);
    border: 2px dashed rgba(148, 163, 184, 0.3);
    border-radius: 16px;
    padding: 48px;
    text-align: center;
    max-width: 500px;
    width: 100%;
  }
  
  .upload-icon {
    font-size: 64px;
    margin-bottom: 16px;
  }
  
  .upload-box h2 {
    color: #f1f5f9;
    margin-bottom: 8px;
  }
  
  .upload-box p {
    color: #94a3b8;
    margin-bottom: 24px;
  }
  
  .upload-button {
    display: inline-block;
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    color: white;
    padding: 14px 32px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  
  .upload-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(59, 130, 246, 0.3);
  }
  
  .upload-button input {
    display: none;
  }
  
  .upload-hint {
    font-size: 12px;
    color: #64748b;
    margin-top: 24px;
  }
  
  .dashboard-header {
    text-align: center;
    margin-bottom: 48px;
    padding-bottom: 32px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  }
  
  .dashboard-title {
    font-size: 42px;
    font-weight: 700;
    background: linear-gradient(135deg, #f8fafc 0%, #94a3b8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -1px;
    margin-bottom: 8px;
  }
  
  .dashboard-subtitle {
    font-size: 16px;
    color: #64748b;
    font-weight: 400;
  }
  
  .dashboard-date {
    display: inline-block;
    margin-top: 16px;
    padding: 8px 20px;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 100px;
    font-size: 13px;
    color: #60a5fa;
    font-family: 'JetBrains Mono', monospace;
  }
  
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 40px;
  }
  
  .metric-card {
    background: linear-gradient(145deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%);
    border: 1px solid rgba(148, 163, 184, 0.1);
    border-radius: 16px;
    padding: 24px;
    transition: all 0.3s ease;
  }
  
  .metric-card:hover {
    border-color: rgba(59, 130, 246, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }
  
  .metric-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  
  .metric-title {
    font-size: 13px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 500;
  }
  
  .metric-trend {
    font-size: 12px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 6px;
  }
  
  .metric-trend.positive {
    color: #10b981;
    background: rgba(16, 185, 129, 0.1);
  }
  
  .metric-trend.negative {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }
  
  .metric-value {
    font-size: 36px;
    font-weight: 700;
    color: #f8fafc;
    font-family: 'JetBrains Mono', monospace;
    line-height: 1;
  }
  
  .metric-subtitle {
    font-size: 12px;
    color: #64748b;
    margin-top: 8px;
  }
  
  .section-title {
    font-size: 20px;
    font-weight: 600;
    color: #f1f5f9;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .section-title::before {
    content: '';
    width: 4px;
    height: 20px;
    background: linear-gradient(180deg, #3b82f6 0%, #8b5cf6 100%);
    border-radius: 2px;
  }
  
  .charts-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
    margin-bottom: 40px;
  }
  
  @media (max-width: 1024px) {
    .charts-grid {
      grid-template-columns: 1fr;
    }
  }
  
  .chart-card {
    background: linear-gradient(145deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%);
    border: 1px solid rgba(148, 163, 184, 0.1);
    border-radius: 16px;
    padding: 24px;
  }
  
  .chart-card.full-width {
    grid-column: 1 / -1;
  }
  
  .chart-title {
    font-size: 16px;
    font-weight: 600;
    color: #e2e8f0;
    margin-bottom: 20px;
  }
  
  .chart-container {
    height: 280px;
  }
  
  .chart-container.tall {
    height: 350px;
  }
  
  .stats-card {
    background: linear-gradient(145deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%);
    border: 1px solid rgba(148, 163, 184, 0.1);
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 40px;
  }
  
  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 0;
    border-bottom: 1px solid rgba(148, 163, 184, 0.08);
  }
  
  .stat-row:last-child {
    border-bottom: none;
  }
  
  .stat-label {
    font-size: 14px;
    color: #94a3b8;
    font-weight: 500;
  }
  
  .stat-values {
    display: flex;
    gap: 32px;
  }
  
  .stat-item {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    color: #f1f5f9;
  }
  
  .stat-type {
    font-size: 10px;
    color: #64748b;
    margin-right: 8px;
    font-weight: 600;
  }
  
  .custom-tooltip {
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 13px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  }
  
  .tooltip-label {
    font-weight: 600;
    color: #f1f5f9;
    margin-bottom: 8px;
  }
  
  .legend-custom {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-top: 16px;
    justify-content: center;
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #94a3b8;
  }
  
  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  
  .footer {
    text-align: center;
    padding-top: 32px;
    border-top: 1px solid rgba(148, 163, 184, 0.1);
    color: #475569;
    font-size: 13px;
  }
  
  .recharts-cartesian-grid-horizontal line,
  .recharts-cartesian-grid-vertical line {
    stroke: rgba(148, 163, 184, 0.08);
  }
  
  .recharts-text {
    fill: #64748b;
    font-size: 12px;
  }
  
  @media (max-width: 768px) {
    .dashboard {
      padding: 16px;
    }
    
    .dashboard-title {
      font-size: 28px;
    }
    
    .stat-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
    
    .stat-values {
      gap: 16px;
      flex-wrap: wrap;
    }
  }
`;
