import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useTicketStore, useAdminStore, useSessionStore } from '../store';
import { Ticket, TicketStatus, User, Role, ErrorType, AutomatedMessage, AuditLog, Feedback, Team } from '../types';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Modal, Textarea, Checkbox } from '../components/ui';
import { ICONS } from '../constants';
import { convertToCSV, downloadCSV } from '../utils';
import { TeamTickets } from './TeamTickets';

// Sub-component for main ticket dashboard
const AdminTicketDashboard: React.FC = () => {
    const { tickets, fetchTickets, updateTicket, kpis, calculateKPIs } = useTicketStore();
    const { users, errorTypes, fetchAdminData } = useAdminStore();
    const { user } = useSessionStore();
    const [activeTab, setActiveTab] = useState<TicketStatus | 'All'>('All');
    const [filter, setFilter] = useState('');
    const [selectedPreId, setSelectedPreId] = useState<'All' | string>('All');
    const [copiedUid, setCopiedUid] = useState<string | null>(null);
    const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
    const [editingComment, setEditingComment] = useState('');

    useEffect(() => {
        fetchTickets();
        fetchAdminData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if(user && tickets.length > 0) {
            calculateKPIs(tickets);
        }
    }, [tickets, user, calculateKPIs]);
    
    const pres = useMemo(() => users.filter(user => user.role === Role.PRE), [users]);

    const handleCopyUid = (uid: string) => {
        navigator.clipboard.writeText(uid);
        setCopiedUid(uid);
        setTimeout(() => setCopiedUid(null), 2000);
    };

    const handleSolveTicket = async (ticketId: string) => {
        await updateTicket({
            id: ticketId,
            status: TicketStatus.COMPLETED,
        });
    };
    
    const handleStartEditingComment = (ticket: Ticket) => {
        setEditingTicketId(ticket.id);
        setEditingComment(ticket.comment || '');
    };

    const handleSaveComment = async (ticketId: string) => {
        await updateTicket({ id: ticketId, comment: editingComment });
        setEditingTicketId(null);
    };

    const filteredTickets = useMemo(() => {
        let filtered = tickets;
        if (activeTab !== 'All') {
            filtered = filtered.filter(t => t.status === activeTab);
        }
        if (selectedPreId !== 'All') {
            filtered = filtered.filter(t => t.preId === selectedPreId);
        }
        if (filter) {
            const lowerFilter = filter.toLowerCase();
            filtered = filtered.filter(t => 
                t.uid.toLowerCase().includes(lowerFilter) || 
                (users.find(u => u.id === t.preId)?.name.toLowerCase().includes(lowerFilter)) ||
                (errorTypes.find(et => et.id === t.errorTypeId)?.name.toLowerCase().includes(lowerFilter))
            );
        }
        return filtered;
    }, [tickets, activeTab, filter, users, errorTypes, selectedPreId]);

    const getMeta = (ticket: Ticket) => ({
        preName: users.find(u => u.id === ticket.preId)?.name || 'Unknown PRE',
        errorName: errorTypes.find(et => et.id === ticket.errorTypeId)?.name || 'Unknown Error'
    });
    
    const handleDownload = () => {
        const headers = [
            { key: 'id', label: 'Ticket ID' },
            { key: 'uid', label: 'UID' },
            { key: 'preName', label: 'PRE Name' },
            { key: 'errorName', label: 'Error Type' },
            { key: 'subject', label: 'Subject' },
            { key: 'status', label: 'Status' },
            { key: 'description', label: 'Description' },
            { key: 'comment', label: 'DataCR Comments' },
            { key: 'attachment', label: 'Attachment' },
            { key: 'createdAt', label: 'Created At' },
            { key: 'updatedAt', label: 'Last Updated' },
        ];

        const dataToExport = filteredTickets.map(ticket => {
            const { preName, errorName } = getMeta(ticket);
            return {
                ...ticket,
                preName,
                errorName,
                attachment: ticket.attachment ? ticket.attachment.name : '-',
                createdAt: new Date(ticket.createdAt).toLocaleString(),
                updatedAt: new Date(ticket.updatedAt).toLocaleString(),
            };
        });

        const csv = convertToCSV(dataToExport, headers);
        downloadCSV(csv, `tickets-overview-${new Date().toISOString().split('T')[0]}.csv`);
    };

    const getStatusSelectClass = (status: TicketStatus) => {
        const base = "h-8 text-xs w-full border rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-sky-500 appearance-none";
        const colors = {
            [TicketStatus.COMPLETED]: 'bg-green-100 border-green-200 text-green-800',
            [TicketStatus.IN_PROGRESS]: 'bg-yellow-100 border-yellow-200 text-yellow-800',
            [TicketStatus.ESCALATED]: 'bg-red-100 border-red-200 text-red-800',
            [TicketStatus.CLOSED]: 'bg-slate-100 border-slate-200 text-slate-800',
        };
        return `${base} ${colors[status]}`;
    };

    const tabs: (TicketStatus | 'All')[] = ['All', TicketStatus.IN_PROGRESS, TicketStatus.ESCALATED, TicketStatus.COMPLETED, TicketStatus.CLOSED];

    return (
        <>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
            <StatCard title="Total Active Tickets" value={kpis.activeTickets} description="Tickets currently in progress or escalated." />
            <StatCard title="Total Closed Tickets" value={kpis.closedTickets} description="All completed or closed tickets in the system." />
            <StatCard title="Overall Avg. Time to Close" value={kpis.avgTimeToSolve} description="Average time taken to resolve a ticket." />
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Ticket Overview</CardTitle>
                <CardDescription>Monitor and manage all submitted tickets.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex justify-between items-center mb-4">
                    <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
                        {tabs.map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === tab ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}>{tab}</button>
                        ))}
                    </div>
                     <div className="flex items-center gap-2">
                        <Select
                            value={selectedPreId}
                            onChange={e => setSelectedPreId(e.target.value)}
                            className="w-auto"
                            aria-label="Filter by PRE name"
                        >
                            <option value="All">All PREs</option>
                            {pres.map(pre => (
                                <option key={pre.id} value={pre.id}>
                                    {pre.name}
                                </option>
                            ))}
                        </Select>
                        <div className="relative w-64">
                            <Input placeholder="Search by UID, PRE, Error..." value={filter} onChange={e => setFilter(e.target.value)} className="pl-10" />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{ICONS.search}</span>
                        </div>
                        <Button variant="secondary" onClick={handleDownload}>
                            <span className="mr-2">{ICONS.download}</span>
                            Download Report
                        </Button>
                    </div>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Ticket ID</TableHead>
                            <TableHead>UID</TableHead>
                            <TableHead>PRE Name</TableHead>
                            <TableHead>Error Type</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>DataCR Comments</TableHead>
                            <TableHead>Attachment</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created At</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredTickets.map(ticket => {
                            const { preName, errorName } = getMeta(ticket);
                            return (
                                <TableRow key={ticket.id}>
                                    <TableCell>{ticket.id}</TableCell>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <span>{ticket.uid}</span>
                                            <button
                                                onClick={() => handleCopyUid(ticket.uid)}
                                                className="text-slate-400 hover:text-sky-600 p-1 rounded-md transition-colors"
                                                aria-label={`Copy UID ${ticket.uid}`}
                                            >
                                                {copiedUid === ticket.uid ? <span className="text-green-500">{ICONS.check}</span> : ICONS.copy}
                                            </button>
                                        </div>
                                    </TableCell>
                                    <TableCell>{preName}</TableCell>
                                    <TableCell>{errorName}</TableCell>
                                    <TableCell className="text-sm text-slate-600 max-w-xs truncate" title={ticket.subject || ''}>{ticket.subject || '–'}</TableCell>
                                    <TableCell className="text-sm text-slate-600 max-w-sm truncate" title={ticket.description}>
                                        {ticket.description}
                                    </TableCell>
                                    <TableCell>
                                        {editingTicketId === ticket.id ? (
                                            <div className="flex items-center gap-1 w-48">
                                                <Input
                                                    value={editingComment}
                                                    onChange={(e) => setEditingComment(e.target.value)}
                                                    className="h-8 text-sm"
                                                    autoFocus
                                                />
                                                <Button size="sm" className="p-2 h-8" onClick={() => handleSaveComment(ticket.id)}>
                                                    {ICONS.check}
                                                </Button>
                                                <Button variant="secondary" size="sm" className="p-2 h-8" onClick={() => setEditingTicketId(null)}>
                                                    {ICONS.close}
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between group max-w-xs">
                                                <span className="text-sm text-slate-600 truncate" title={ticket.comment ?? ''}>
                                                    {ticket.comment || '–'}
                                                </span>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="px-2 py-1 h-auto opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => handleStartEditingComment(ticket)}
                                                >
                                                    {ICONS.edit}
                                                </Button>
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {ticket.attachment ? (
                                            <div className="flex items-center gap-2 text-slate-600" title={`${ticket.attachment.name} (${(ticket.attachment.size / 1024).toFixed(2)} KB)`}>
                                                {ICONS.paperclip}
                                                <span className="truncate text-sm">{ticket.attachment.name}</span>
                                            </div>
                                        ) : '–'}
                                    </TableCell>
                                    <TableCell>
                                        <Select
                                            value={ticket.status}
                                            onChange={(e) => updateTicket({ id: ticket.id, status: e.target.value as TicketStatus })}
                                            className={getStatusSelectClass(ticket.status)}
                                        >
                                            {Object.values(TicketStatus).map(status => (
                                                <option key={status} value={status}>{status}</option>
                                            ))}
                                        </Select>
                                    </TableCell>
                                    <TableCell>{new Date(ticket.createdAt).toLocaleString()}</TableCell>
                                    <TableCell>
                                        {(user?.role === Role.ADMIN || user?.role === Role.DATACR) && ticket.status === TicketStatus.ESCALATED && (
                                            <Button size="sm" onClick={() => handleSolveTicket(ticket.id)}>
                                                Solved
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        </>
    );
};

const StatCard: React.FC<{ title: string, value: string | number, description: string }> = ({ title, value, description }) => (
    <Card>
        <CardHeader>
            <CardDescription>{title}</CardDescription>
            <CardTitle>{value}</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-xs text-slate-500">{description}</p>
        </CardContent>
    </Card>
);

const ErrorAnalytics: React.FC = () => {
    const { tickets, fetchTickets } = useTicketStore();
    const { errorTypes, fetchAdminData } = useAdminStore();
    const [tooltip, setTooltip] = useState<{ show: boolean, content: React.ReactNode, x: number, y: number } | null>(null);
    
    const getInitialDateRange = () => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 6);
        return {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0],
        };
    };
    const [dateRange, setDateRange] = useState(getInitialDateRange());

    useEffect(() => {
        fetchTickets();
        fetchAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const analyticsData = useMemo(() => {
        if (tickets.length === 0 || errorTypes.length === 0) return null;
        const counts = errorTypes.map(et => ({
            id: et.id, name: et.name,
            count: tickets.filter(t => t.errorTypeId === et.id).length,
        }));
        const totalTickets = tickets.length;
        const mostFrequent = counts.reduce((max, current) => current.count > max.count ? current : max, counts[0]);
        const inProgress = tickets.filter(t => t.status === TicketStatus.IN_PROGRESS).length;
        return { counts, totalTickets, mostFrequent, inProgress };
    }, [tickets, errorTypes]);

    const monthlyDistributionData = useMemo(() => {
        if (tickets.length === 0 || errorTypes.length === 0 || !dateRange.start || !dateRange.end) return null;

        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);

        const monthLabelsMap = new Map<string, string>();
        let currentDate = new Date(startDate);
        currentDate.setDate(1);

        while (currentDate <= endDate) {
            const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            const label = currentDate.toLocaleString('default', { month: 'short', year: '2-digit' });
            monthLabelsMap.set(monthKey, label);
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
        
        const monthKeys = Array.from(monthLabelsMap.keys());
        
        const filteredTickets = tickets.filter(ticket => {
            const ticketDate = new Date(ticket.createdAt);
            return ticketDate.getTime() >= startDate.getTime() && ticketDate.getTime() <= endDate.getTime();
        });
        
        const dataByMonth: { [month: string]: { [errorTypeId: string]: number } } = {};

        filteredTickets.forEach(ticket => {
            const ticketDate = new Date(ticket.createdAt);
            const monthKey = `${ticketDate.getFullYear()}-${String(ticketDate.getMonth() + 1).padStart(2, '0')}`;
             
            if (monthLabelsMap.has(monthKey)) {
                if (!dataByMonth[monthKey]) dataByMonth[monthKey] = {};
                dataByMonth[monthKey][ticket.errorTypeId] = (dataByMonth[monthKey][ticket.errorTypeId] || 0) + 1;
            }
        });

        const chartData = monthKeys.map(key => {
            const monthData = dataByMonth[key] || {};
            const total = Object.values(monthData).reduce((sum, count) => sum + count, 0);
            return { month: monthLabelsMap.get(key)!, counts: monthData, total };
        });

        const lastMonthTotal = chartData[chartData.length - 1]?.total || 0;
        const secondLastMonthTotal = chartData.length > 1 ? chartData[chartData.length - 2]?.total : 0;
        let trend = 0;
        if (secondLastMonthTotal > 0) {
            trend = ((lastMonthTotal - secondLastMonthTotal) / secondLastMonthTotal) * 100;
        } else if (lastMonthTotal > 0) {
            trend = 100;
        }
        
        return { chartData, trend };
    }, [tickets, errorTypes, dateRange]);
    
    const handleDownloadDistribution = () => {
        if (!analyticsData) return;

        const headers = [
            { key: 'name', label: 'Error Type' },
            { key: 'count', label: 'Ticket Count' },
        ];
        
        const csv = convertToCSV(analyticsData.counts, headers);
        downloadCSV(csv, `error-type-distribution-${new Date().toISOString().split('T')[0]}.csv`);
    };

    const handleDownloadMonthly = () => {
        if (!monthlyDistributionData) return;

        const headers = [
            { key: 'month', label: 'Month' },
            { key: 'errorType', label: 'Error Type' },
            { key: 'count', label: 'Count' },
        ];
        
        const dataToExport = monthlyDistributionData.chartData.flatMap(monthData => {
            if (Object.keys(monthData.counts).length === 0) {
                return [{ month: monthData.month, errorType: 'N/A', count: 0 }];
            }
            return Object.entries(monthData.counts).map(([errorTypeId, count]) => ({
                month: monthData.month,
                errorType: errorTypes.find(et => et.id === errorTypeId)?.name || 'Unknown',
                count,
            }));
        });

        const csv = convertToCSV(dataToExport, headers);
        downloadCSV(csv, `monthly-distribution-${dateRange.start}-to-${dateRange.end}.csv`);
    };

    if (!analyticsData) {
        return <p>Loading analytics data...</p>;
    }

    const barColors = ['bg-sky-500', 'bg-teal-500', 'bg-amber-500', 'bg-indigo-500', 'bg-rose-500'];
    const errorTypeColorMap = new Map(errorTypes.map((et, i) => [et.id, barColors[i % barColors.length]]));
    const maxCount = Math.max(...analyticsData.counts.map(c => c.count), 1);
    const maxMonthlyTotal = monthlyDistributionData ? Math.max(...monthlyDistributionData.chartData.map(d => d.total), 0) : 0;
    const yAxisMax = Math.ceil(maxMonthlyTotal / 5) * 5 || 5;

    const handleMouseOver = (e: React.MouseEvent, monthData: any, errorTypeId: string) => {
        const errorType = errorTypes.find(et => et.id === errorTypeId);
        if (!errorType) return;
        const content = (<div><p className="font-bold">{monthData.month}</p><p>{errorType.name}: <span className="font-semibold">{monthData.counts[errorTypeId]}</span></p></div>);
        setTooltip({ show: true, content, x: e.clientX, y: e.clientY });
    };
    const handleMouseOut = () => setTooltip(null);

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Tickets" value={analyticsData.totalTickets} description="All tickets submitted to the system." />
                <StatCard title="Tickets In Progress" value={analyticsData.inProgress} description="Tickets actively being worked on." />
                <StatCard title="Most Frequent Error" value={analyticsData.mostFrequent.name} description={`${analyticsData.mostFrequent.count} occurrences.`} />
                {monthlyDistributionData && (
                     <StatCard 
                        title="MoM Trend" 
                        value={`${monthlyDistributionData.trend >= 0 ? '+' : ''}${monthlyDistributionData.trend.toFixed(1)}%`}
                        description={`Change in tickets from previous month.`}
                    />
                )}
            </div>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Error Type Distribution</CardTitle>
                            <CardDescription>Number of tickets submitted for each error type.</CardDescription>
                        </div>
                         <Button variant="secondary" size="sm" onClick={handleDownloadDistribution}>
                            <span className="mr-2">{ICONS.download}</span>
                            Download
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {analyticsData.counts.map((item, index) => (
                            <div key={item.id} className="grid grid-cols-4 items-center gap-4">
                                <div className="text-sm font-medium text-slate-700 truncate col-span-1">{item.name}</div>
                                <div className="col-span-3 flex items-center">
                                    <div className="w-full bg-slate-100 rounded-full h-6 mr-4">
                                        <div className={`${barColors[index % barColors.length]} h-6 rounded-full flex items-center justify-end px-2 text-white text-xs font-bold`}
                                            style={{ width: `${(item.count / maxCount) * 100}%`, minWidth: '25px' }}>
                                            {item.count}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Monthly Error Distribution</CardTitle>
                            <CardDescription>Ticket volume and breakdown over the past months.</CardDescription>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                    className="w-auto h-9"
                                />
                                <span className="text-sm text-slate-500">to</span>
                                <Input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                    className="w-auto h-9"
                                />
                            </div>
                             <Button variant="secondary" size="sm" onClick={handleDownloadMonthly}>
                                <span className="mr-2">{ICONS.download}</span>
                                Download
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {monthlyDistributionData && monthlyDistributionData.chartData.length > 0 ? (
                        <div className="relative">
                            {tooltip?.show && (<div className="absolute bg-slate-800 text-white text-xs rounded-md p-2 shadow-lg z-10" style={{ top: tooltip.y - 80, left: tooltip.x - 40, pointerEvents: 'none' }}>{tooltip.content}</div>)}
                            <div className="flex h-72 border-l border-b border-slate-200">
                                <div className="flex flex-col justify-between text-xs text-slate-500 pr-2 py-1 h-full -ml-1">
                                    <span>{yAxisMax}</span><span>{Math.round(yAxisMax * 0.75)}</span><span>{Math.round(yAxisMax * 0.5)}</span><span>{Math.round(yAxisMax * 0.25)}</span><span>0</span>
                                </div>
                                <div className="flex-1 grid gap-4 items-end pl-2" style={{ gridTemplateColumns: `repeat(${monthlyDistributionData.chartData.length}, 1fr)` }}>
                                    {monthlyDistributionData.chartData.map(monthData => (
                                        <div key={monthData.month} className="h-full flex flex-col items-center justify-end">
                                            <div className="w-10/12 bg-slate-100 rounded-t-md flex flex-col overflow-hidden" style={{ height: `${(monthData.total / yAxisMax) * 100}%` }}>
                                                {Object.entries(monthData.counts).map(([errorTypeId, count]) => (
                                                    <div key={errorTypeId} className={`${errorTypeColorMap.get(errorTypeId)} transition-opacity hover:opacity-80`} style={{ height: `${(count / monthData.total) * 100}%` }}
                                                        onMouseMove={(e) => handleMouseOver(e, monthData, errorTypeId)} onMouseLeave={handleMouseOut}/>
                                                ))}
                                            </div>
                                            <div className="text-xs text-slate-600 mt-2">{monthData.month}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                             <div className="flex justify-center items-center flex-wrap gap-x-4 gap-y-2 mt-6">
                                {errorTypes.map(et => (<div key={et.id} className="flex items-center text-xs text-slate-600"><span className={`h-3 w-3 rounded-sm mr-2 ${errorTypeColorMap.get(et.id)}`}></span><span>{et.name}</span></div>))}
                            </div>
                        </div>
                    ) : (<p className="text-slate-500 text-center py-8">Not enough data to display the monthly chart.</p>)}
                </CardContent>
            </Card>
        </div>
    );
};

type ChartDataPoint = {
    label: string;
    total: number;
    errors: { [errorId: string]: number };
    rps: { [errorId: string]: { [rpName: string]: number } };
};

const DetailedErrorAnalytics: React.FC = () => {
    const { tickets, fetchTickets } = useTicketStore();
    const { users, errorTypes, fetchAdminData } = useAdminStore();
    const [viewMode, setViewMode] = useState<'monthly' | 'daily'>('monthly');
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [chartDimensions, setChartDimensions] = useState({ width: 0, height: 0 });
    
    const allRpNames = useMemo(() => [...new Set(tickets.map(t => t.rpName).filter(Boolean) as string[])].sort(), [tickets]);
    const allErrorTypes = useMemo(() => errorTypes.sort((a,b) => a.name.localeCompare(b.name)), [errorTypes]);
    const allStatuses = useMemo(() => Object.values(TicketStatus).sort(), []);

    const [selectedRps, setSelectedRps] = useState<string[]>([]);
    const [selectedErrorTypes, setSelectedErrorTypes] = useState<string[]>([]);
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
    const [tooltip, setTooltip] = useState<{ show: boolean, content: React.ReactNode, x: number, y: number } | null>(null);

    useEffect(() => {
        fetchTickets();
        fetchAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (chartContainerRef.current) {
            setChartDimensions({
                width: chartContainerRef.current.clientWidth,
                height: chartContainerRef.current.clientHeight,
            });
        }
    }, []);

    useEffect(() => {
        if (allRpNames.length > 0 && selectedRps.length === 0) setSelectedRps(allRpNames);
        if (allErrorTypes.length > 0 && selectedErrorTypes.length === 0) setSelectedErrorTypes(allErrorTypes.map(et => et.id));
        if (allStatuses.length > 0 && selectedStatuses.length === 0) setSelectedStatuses(allStatuses);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allRpNames, allErrorTypes, allStatuses]);


    const handleCheckboxChange = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
        setter(prev => prev.includes(value) ? prev.filter(i => i !== value) : [...prev, value]);
    };
    
    const filteredTickets = useMemo(() => {
        return tickets.filter(t => {
            const isRpSelected = selectedRps.length === 0 || (t.rpName ? selectedRps.includes(t.rpName) : true);
            const isErrorTypeSelected = selectedErrorTypes.length === 0 || selectedErrorTypes.includes(t.errorTypeId);
            const isStatusSelected = selectedStatuses.length === 0 || selectedStatuses.includes(t.status);
            return isRpSelected && isErrorTypeSelected && isStatusSelected;
        });
    }, [tickets, selectedRps, selectedErrorTypes, selectedStatuses]);
    
    const chartData: ChartDataPoint[] = useMemo(() => {
        if (filteredTickets.length === 0) return [];
        
        const dataAggregator: { [key: string]: Omit<ChartDataPoint, 'label'> } = {};

        filteredTickets.forEach(ticket => {
            const ticketDate = new Date(ticket.createdAt);
            const key = viewMode === 'monthly'
                ? `${ticketDate.getFullYear()}-${String(ticketDate.getMonth() + 1).padStart(2, '0')}`
                : ticketDate.toISOString().split('T')[0];

            if (!dataAggregator[key]) {
                dataAggregator[key] = { total: 0, errors: {}, rps: {} };
            }
            
            dataAggregator[key].total++;
            dataAggregator[key].errors[ticket.errorTypeId] = (dataAggregator[key].errors[ticket.errorTypeId] || 0) + 1;

            if (ticket.rpName) {
                if (!dataAggregator[key].rps[ticket.errorTypeId]) dataAggregator[key].rps[ticket.errorTypeId] = {};
                dataAggregator[key].rps[ticket.errorTypeId][ticket.rpName] = (dataAggregator[key].rps[ticket.errorTypeId][ticket.rpName] || 0) + 1;
            }
        });

        const sortedKeys = Object.keys(dataAggregator).sort((a, b) => {
            const dateA = new Date(a.length === 7 ? `${a}-01` : a);
            const dateB = new Date(b.length === 7 ? `${b}-01` : b);
            return dateA.getTime() - dateB.getTime();
        });

        return sortedKeys.map(key => {
            let label = key;
            if (viewMode === 'monthly') {
                const date = new Date(`${key}-02`); // Use day 02 to avoid timezone issues
                label = date.toLocaleString('default', { month: 'short', year: '2-digit' });
            } else {
                label = key.slice(5); // Keep MM-DD for daily
            }
            return {
                label, 
                ...dataAggregator[key] 
            };
        });

    }, [filteredTickets, viewMode]);

    const getFilterCounts = (filterType: 'rp' | 'error' | 'status') => {
        const counts: { [key: string]: number } = {};
        let sourceList: any[];
        let key: string;

        switch (filterType) {
            case 'rp':
                sourceList = allRpNames;
                key = 'rpName';
                break;
            case 'error':
                sourceList = allErrorTypes;
                key = 'errorTypeId';
                break;
            case 'status':
                sourceList = allStatuses;
                key = 'status';
                break;
        }

        const baseFilter = (t: Ticket, value: string) => {
            if(filterType === 'rp') return t.rpName === value;
            if(filterType === 'error') return t.errorTypeId === value;
            if(filterType === 'status') return t.status === value;
            return false;
        };

        sourceList.forEach(item => {
            const value = filterType === 'error' ? item.id : item;
            counts[value] = tickets.filter(t => baseFilter(t, value)).length;
        });

        return counts;
    };
    
    const rpCounts = useMemo(() => getFilterCounts('rp'), [tickets, allRpNames]);
    const errorCounts = useMemo(() => getFilterCounts('error'), [tickets, allErrorTypes]);
    const statusCounts = useMemo(() => getFilterCounts('status'), [tickets, allStatuses]);
    
    const handleDownload = () => {
        const headers = [
            { key: 'id', label: 'Ticket ID' },
            { key: 'uid', label: 'UID' },
            { key: 'preName', label: 'PRE Name' },
            { key: 'rpName', label: 'RP Name' },
            { key: 'team', label: 'Team' },
            { key: 'errorName', label: 'Error Type' },
            { key: 'status', label: 'Status' },
            { key: 'createdAt', label: 'Created At' },
        ];

        const dataToExport = filteredTickets.map(ticket => ({
            ...ticket,
            preName: users.find(u => u.id === ticket.preId)?.name || 'Unknown PRE',
            errorName: errorTypes.find(et => et.id === ticket.errorTypeId)?.name || 'Unknown Error',
            createdAt: new Date(ticket.createdAt).toLocaleString(),
        }));

        const csv = convertToCSV(dataToExport, headers);
        downloadCSV(csv, `detailed-analytics-${new Date().toISOString().split('T')[0]}.csv`);
    };

    const colors = ['#38bdf8', '#2dd4bf', '#f59e0b', '#818cf8', '#f43f5e'];
    const errorTypeColorMap = new Map(allErrorTypes.map((et, i) => [et.id, colors[i % colors.length]]));

    const handleMouseOver = (e: React.MouseEvent, dataPoint: ChartDataPoint, errorTypeId: string) => {
         const errorType = errorTypes.find(et => et.id === errorTypeId);
        if (!errorType) return;
        const rpBreakdown = dataPoint.rps[errorTypeId];
        const content = (
            <div>
                <p className="font-bold text-base mb-1">{errorType.name}: {dataPoint.errors[errorTypeId]}</p>
                <ul className="text-xs space-y-0.5">
                    {rpBreakdown && Object.entries(rpBreakdown).map(([rp, count]) => (
                        <li key={rp}>{rp}: <span className="font-semibold">{count}</span></li>
                    ))}
                </ul>
            </div>
        );
        setTooltip({ show: true, content, x: e.clientX, y: e.clientY });
    };

    const handleMouseOut = () => setTooltip(null);
    
    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    const yAxisHeight = chartDimensions.height - margin.top - margin.bottom;
    const xAxisWidth = chartDimensions.width - margin.left - margin.right;
    const maxTotal = Math.max(...chartData.map(d => d.total), 1);
    const yTickCount = 5;

    const FilterSection: React.FC<{ title: string; items: any[]; selectedItems: string[]; onSelectionChange: (value: string) => void; counts: { [key: string]: number }; nameKey?: string; idKey?: string; }> = 
    ({ title, items, selectedItems, onSelectionChange, counts, nameKey = 'name', idKey = 'id' }) => (
        <div>
            <Label className="mb-2 block font-semibold text-slate-800">{title}</Label>
            <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                {items.map(item => {
                    const id = String(idKey && typeof item === 'object' && item !== null ? (item as any)[idKey] : item);
                    const name = (nameKey && typeof item === 'object' && item !== null ? (item as any)[nameKey] : item) ?? item;
                    // FIX: The subtraction operator (-) cannot be used on strings. Using template literal for string concatenation to create a unique ID.
                    const elementId = `${title}-${id}`;
                    return (
                        <div key={id} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Checkbox id={elementId} checked={selectedItems.includes(id)} onChange={() => onSelectionChange(id)} />
                                <Label htmlFor={elementId} className="font-normal cursor-pointer">{String(name)}</Label>
                            </div>
                            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">{counts[id] || 0}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                    <FilterSection title="RP Name" items={allRpNames} selectedItems={selectedRps} onSelectionChange={(val) => handleCheckboxChange(setSelectedRps, val)} counts={rpCounts} nameKey="" idKey="" />
                    <FilterSection title="Error Type" items={allErrorTypes} selectedItems={selectedErrorTypes} onSelectionChange={(val) => handleCheckboxChange(setSelectedErrorTypes, val)} counts={errorCounts} />
                    <FilterSection title="Ticket Status" items={allStatuses} selectedItems={selectedStatuses} onSelectionChange={(val) => handleCheckboxChange(setSelectedStatuses, val)} counts={statusCounts} nameKey="" idKey="" />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Monthly & Date-wise Error Distribution</CardTitle>
                            <CardDescription>Breakdown of tickets by error type and RP name.</CardDescription>
                        </div>
                         <div className="flex items-center gap-2">
                            <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
                                <button onClick={() => setViewMode('monthly')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'monthly' ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}>Monthly</button>
                                <button onClick={() => setViewMode('daily')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'daily' ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}>Daily</button>
                            </div>
                             <Button variant="secondary" onClick={handleDownload}>
                                <span className="mr-2">{ICONS.download}</span>
                                Download Report
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="h-[450px] relative" ref={chartContainerRef}>
                    {tooltip?.show && (<div className="absolute bg-slate-800 text-white rounded-md p-2 shadow-lg z-20 pointer-events-none transition-transform" style={{ top: tooltip.y + 10, left: tooltip.x + 10, minWidth: '120px' }}>{tooltip.content}</div>)}
                    {chartData.length > 0 ? (
                        <svg width="100%" height="100%">
                           <g transform={`translate(${margin.left}, ${margin.top})`}>
                                {/* Y-Axis */}
                                {Array.from({ length: yTickCount + 1 }).map((_, i) => {
                                    const y = yAxisHeight - i * (yAxisHeight / yTickCount);
                                    const tickValue = Math.round(i * (maxTotal / yTickCount));
                                    return (
                                        <g key={i} className="text-slate-500">
                                            <line x1={-5} y1={y} x2={xAxisWidth} y2={y} stroke="currentColor" className="stroke-slate-200" strokeDasharray="2,3" />
                                            <text x={-10} y={y + 4} textAnchor="end" className="text-xs fill-current">{tickValue}</text>
                                        </g>
                                    );
                                })}
                                {/* X-Axis and Bars */}
                                {chartData.map((dataPoint, index) => {
                                    const barWidth = xAxisWidth / chartData.length * 0.7;
                                    const x = (index * (xAxisWidth / chartData.length)) + (xAxisWidth / chartData.length * 0.15);
                                    let yOffset = yAxisHeight;
                                    
                                    return (
                                        <g key={dataPoint.label}>
                                            {selectedErrorTypes.map(errorTypeId => {
                                                const count = dataPoint.errors[errorTypeId] || 0;
                                                if (count === 0) return null;
                                                
                                                const barHeight = (count / maxTotal) * yAxisHeight;
                                                yOffset -= barHeight;

                                                return (
                                                     <rect
                                                        key={errorTypeId}
                                                        x={x}
                                                        y={yOffset}
                                                        width={barWidth}
                                                        height={barHeight}
                                                        fill={errorTypeColorMap.get(errorTypeId)}
                                                        onMouseMove={(e) => handleMouseOver(e, dataPoint, errorTypeId)}
                                                        onMouseLeave={handleMouseOut}
                                                        className="transition-opacity hover:opacity-80 cursor-pointer"
                                                    />
                                                );
                                            })}
                                            <text x={x + barWidth / 2} y={yAxisHeight + 15} textAnchor="middle" className="text-xs fill-slate-600">{dataPoint.label}</text>
                                        </g>
                                    )
                                })}
                           </g>
                        </svg>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-500">No data available for the selected filters.</div>
                    )}
                </CardContent>
                 <div className="flex justify-center items-center flex-wrap gap-x-4 gap-y-2 mt-2 pb-4">
                    {errorTypes.filter(et => selectedErrorTypes.includes(et.id)).map(et => (<div key={et.id} className="flex items-center text-xs text-slate-600"><span className={`h-3 w-3 rounded-sm mr-2`} style={{backgroundColor: errorTypeColorMap.get(et.id)}}></span><span>{et.name}</span></div>))}
                </div>
            </Card>
        </div>
    );
};

const BulkAddModal: React.FC<{ isOpen: boolean, onClose: () => void }> = ({ isOpen, onClose }) => {
    const { addBulkUsers, users } = useAdminStore();
    const [csvData, setCsvData] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');

    const handleBulkAdd = async () => {
        setIsProcessing(true);
        setError('');
        
        if (!csvData.trim()) {
            setError('CSV data cannot be empty.');
            setIsProcessing(false);
            return;
        }
        
        const lines = csvData.trim().split('\n');
        const headersLine = lines.shift();
        if (!headersLine) {
             setError('CSV is empty or has no header.');
             setIsProcessing(false);
             return;
        }
        const headers = headersLine.split(',').map(h => h.trim());
        
        if (!['name', 'email', 'role', 'team'].every(h => headers.includes(h))) {
            setError('Invalid CSV headers. Required: name, email, role, team. Optional: managerEmail');
            setIsProcessing(false);
            return;
        }

        const newUsersData: Omit<User, 'id'>[] = [];
        for (const line of lines) {
            if (!line.trim()) continue;
            const values = line.split(',').map(v => v.trim());
            const userObject: any = {};
            headers.forEach((header, index) => {
                userObject[header] = values[index];
            });

            // Basic validation
            if (!userObject.name || !userObject.email || !userObject.role || !userObject.team) {
                setError(`Missing required fields for one or more users on line: ${line}`);
                setIsProcessing(false);
                return;
            }

            const manager = users.find(u => u.email === userObject.managerEmail);
            
            newUsersData.push({
                name: userObject.name,
                email: userObject.email,
                role: userObject.role as Role,
                team: userObject.team as Team,
                managerId: manager?.id,
            });
        }
        
        try {
            await addBulkUsers(newUsersData);
            setCsvData('');
            onClose();
        } catch (e) {
            setError('Failed to add users. Please check the data and try again.');
        } finally {
            setIsProcessing(false);
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <h3 className="text-lg font-medium mb-2">Add Bulk PREs</h3>
            <p className="text-slate-600 mb-4 text-sm">
                Paste CSV data below. Required columns: <strong>name, email, role, team</strong>. Optional: <strong>managerEmail</strong>. The first line must be the header.
            </p>
            <Textarea 
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                placeholder={"name,email,role,team,managerEmail\nJohn Doe,john@example.com,PRE,Onboarding Team,bdm@example.com"}
                className="min-h-[200px] font-mono text-xs"
            />
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            <div className="flex justify-end gap-2 mt-4">
                <Button variant="secondary" onClick={onClose} disabled={isProcessing}>Cancel</Button>
                <Button onClick={handleBulkAdd} disabled={isProcessing}>
                    {isProcessing ? 'Processing...' : 'Add Users'}
                </Button>
            </div>
        </Modal>
    );
};

const BulkAddErrorTypesModal: React.FC<{ isOpen: boolean, onClose: () => void }> = ({ isOpen, onClose }) => {
    const { addBulkErrorTypes } = useAdminStore();
    const [csvData, setCsvData] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');

    const handleBulkAdd = async () => {
        setIsProcessing(true);
        setError('');
        
        if (!csvData.trim()) {
            setError('CSV data cannot be empty.');
            setIsProcessing(false);
            return;
        }
        
        const lines = csvData.trim().split('\n');
        const headersLine = lines.shift();
        if (!headersLine) {
             setError('CSV is empty or has no header.');
             setIsProcessing(false);
             return;
        }
        const headers = headersLine.split(',').map(h => h.trim());
        
        if (!['name', 'description'].every(h => headers.includes(h))) {
            setError('Invalid CSV headers. Required: name, description');
            setIsProcessing(false);
            return;
        }

        const newErrorTypesData: Omit<ErrorType, 'id'>[] = [];
        for (const line of lines) {
            if (!line.trim()) continue;
            const values = line.split(',').map(v => v.trim());
            const errorTypeObject: any = {};
            headers.forEach((header, index) => {
                errorTypeObject[header] = values[index];
            });

            if (!errorTypeObject.name || !errorTypeObject.description) {
                setError(`Missing required fields on line: ${line}`);
                setIsProcessing(false);
                return;
            }
            
            newErrorTypesData.push({
                name: errorTypeObject.name,
                description: errorTypeObject.description,
            });
        }
        
        try {
            await addBulkErrorTypes(newErrorTypesData);
            setCsvData('');
            onClose();
        } catch (e) {
            setError('Failed to add error types. Please check the data and try again.');
        } finally {
            setIsProcessing(false);
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <h3 className="text-lg font-medium mb-2">Add Bulk Error Types</h3>
            <p className="text-slate-600 mb-4 text-sm">
                Paste CSV data below. Required columns: <strong>name, description</strong>. The first line must be the header.
            </p>
            <Textarea 
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                placeholder={"name,description\nNew Error,A description for the new error."}
                className="min-h-[200px] font-mono text-xs"
            />
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            <div className="flex justify-end gap-2 mt-4">
                <Button variant="secondary" onClick={onClose} disabled={isProcessing}>Cancel</Button>
                <Button onClick={handleBulkAdd} disabled={isProcessing}>
                    {isProcessing ? 'Processing...' : 'Add Error Types'}
                </Button>
            </div>
        </Modal>
    );
};

const BulkAddMessagesModal: React.FC<{ isOpen: boolean, onClose: () => void }> = ({ isOpen, onClose }) => {
    const { addBulkMessages, errorTypes } = useAdminStore();
    const [csvData, setCsvData] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');

    const handleBulkAdd = async () => {
        setIsProcessing(true);
        setError('');
        
        if (!csvData.trim()) {
            setError('CSV data cannot be empty.');
            setIsProcessing(false);
            return;
        }
        
        const lines = csvData.trim().split('\n');
        const headersLine = lines.shift();
        if (!headersLine) {
             setError('CSV is empty or has no header.');
             setIsProcessing(false);
             return;
        }
        const headers = headersLine.split(',').map(h => h.trim());
        
        if (!['errorTypeName', 'message'].every(h => headers.includes(h))) {
            setError('Invalid CSV headers. Required: errorTypeName, message');
            setIsProcessing(false);
            return;
        }
        
        const errorTypeMap = new Map(errorTypes.map(et => [et.name.toLowerCase(), et.id]));

        const newMessagesData: Omit<AutomatedMessage, 'id'>[] = [];
        for (const line of lines) {
            if (!line.trim()) continue;
            // A simple regex to handle commas inside quoted messages
            const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
            
            if(values.length !== headers.length) {
                setError(`Column count mismatch on line: ${line}`);
                setIsProcessing(false);
                return;
            }
            
            const messageObject: any = {};
            headers.forEach((header, index) => {
                messageObject[header] = values[index];
            });

            if (!messageObject.errorTypeName || !messageObject.message) {
                setError(`Missing required fields on line: ${line}`);
                setIsProcessing(false);
                return;
            }
            
            const errorTypeId = errorTypeMap.get(messageObject.errorTypeName.toLowerCase());
            if (!errorTypeId) {
                setError(`Error Type "${messageObject.errorTypeName}" not found on line: ${line}`);
                setIsProcessing(false);
                return;
            }
            
            newMessagesData.push({
                errorTypeId: errorTypeId,
                message: messageObject.message,
            });
        }
        
        try {
            await addBulkMessages(newMessagesData);
            setCsvData('');
            onClose();
        } catch (e) {
            // FIX: The caught error `e` is of type `unknown`. Check if it is an instance of Error before accessing `e.message` to avoid a type error.
            if (e instanceof Error) {
                setError(e.message);
            } else {
                setError('Failed to add messages. An unknown error occurred.');
            }
        } finally {
            setIsProcessing(false);
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <h3 className="text-lg font-medium mb-2">Add Bulk Automated Messages</h3>
            <p className="text-slate-600 mb-4 text-sm">
                Paste CSV data below. Required columns: <strong>errorTypeName, message</strong>. The first line must be the header. The error type name must match an existing error type.
            </p>
            <Textarea 
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                placeholder={'errorTypeName,message\nData Mismatch,"We are looking into the data mismatch, this may take a moment."'}
                className="min-h-[200px] font-mono text-xs"
            />
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            <div className="flex justify-end gap-2 mt-4">
                <Button variant="secondary" onClick={onClose} disabled={isProcessing}>Cancel</Button>
                <Button onClick={handleBulkAdd} disabled={isProcessing}>
                    {isProcessing ? 'Processing...' : 'Add Messages'}
                </Button>
            </div>
        </Modal>
    );
};


// Sub-component for PRE management
const UserManagement: React.FC = () => {
    const { users, addUser, updateUser, deleteUser, fetchAdminData, addBulkUsers } = useAdminStore();
    const { user: currentUser } = useSessionStore();
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [userFormData, setUserFormData] = useState<Partial<User>>({});
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);

    const isEditMode = !!userFormData.id;
    
    useEffect(() => {
        fetchAdminData();
         // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const managers = useMemo(() => {
        if (userFormData.role === Role.PRE) return users.filter(u => u.role === Role.BDM);
        if (userFormData.role === Role.BDM) return users.filter(u => u.role === Role.ASM);
        return [];
    }, [users, userFormData.role]);

    const handleAddModalOpen = () => {
        setUserFormData({ name: '', email: '', role: Role.PRE, team: Team.ONBOARDING });
        setIsUserModalOpen(true);
    };

    const handleEditModalOpen = (user: User) => {
        setUserFormData(user);
        setIsUserModalOpen(true);
    };

    const handleSaveUser = async () => {
        if (!userFormData.name || !userFormData.email) {
            alert('Name and email are required.');
            return;
        }
        if (isEditMode) {
            await updateUser(userFormData as User);
        } else {
            await addUser(userFormData as Omit<User, 'id'>);
        }
        setIsUserModalOpen(false);
    };
    
    const handleDeleteRequest = (user: User) => {
        setUserToDelete(user);
        setIsConfirmModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (userToDelete) {
            await deleteUser(userToDelete.id);
            setIsConfirmModalOpen(false);
            setUserToDelete(null);
        }
    };

    return (
        <>
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>User Management</CardTitle>
                        <CardDescription>Add, edit, or remove users.</CardDescription>
                    </div>
                    {currentUser?.role === Role.ADMIN && (
                        <div className="flex items-center gap-2">
                           <Button onClick={() => setIsBulkModalOpen(true)} variant="secondary"><span className="mr-2">{ICONS.upload}</span>Add Bulk PREs</Button>
                           <Button onClick={handleAddModalOpen}><span className="mr-2">{ICONS.plus}</span>Add User</Button>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Team</TableHead><TableHead>Manager</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {users.map(user => {
                            const managerName = users.find(u => u.id === user.managerId)?.name || 'N/A';
                            return (
                                <TableRow key={user.id}>
                                    <TableCell>{user.name}</TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell><Badge>{user.role}</Badge></TableCell>
                                    <TableCell>{user.team || 'N/A'}</TableCell>
                                    <TableCell>{managerName}</TableCell>
                                    <TableCell className="space-x-2">
                                        {currentUser?.role === Role.ADMIN && user.role !== Role.ADMIN && (
                                        <>
                                            <Button onClick={() => handleEditModalOpen(user)} variant="secondary" size="sm" className="px-2 py-1 h-auto"><span className="text-slate-600">{ICONS.edit}</span></Button>
                                            <Button onClick={() => handleDeleteRequest(user)} variant="danger" size="sm" className="px-2 py-1 h-auto"><span className="text-white">{ICONS.delete}</span></Button>
                                        </>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                 </Table>
            </CardContent>
        </Card>
        <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)}>
            <h3 className="text-lg font-medium mb-4">{isEditMode ? 'Edit User' : 'Add New User'}</h3>
            <div className="space-y-4">
                <div><Label htmlFor="user-name">Name</Label><Input id="user-name" value={userFormData.name || ''} onChange={e => setUserFormData({...userFormData, name: e.target.value})} /></div>
                <div><Label htmlFor="user-email">Email</Label><Input id="user-email" type="email" value={userFormData.email || ''} onChange={e => setUserFormData({...userFormData, email: e.target.value})} /></div>
                <div>
                    <Label htmlFor="user-role">Role</Label>
                    <Select id="user-role" value={userFormData.role} onChange={e => setUserFormData({...userFormData, role: e.target.value as Role, managerId: undefined })}>
                        {Object.values(Role).filter(r => r !== Role.ADMIN).map(role => (
                            <option key={role} value={role}>{role}</option>
                        ))}
                    </Select>
                </div>
                {(userFormData.role === Role.PRE || userFormData.role === Role.BDM || userFormData.role === Role.ASM) && (
                  <div>
                      <Label htmlFor="user-team">Team</Label>
                      <Select id="user-team" value={userFormData.team} onChange={e => setUserFormData({...userFormData, team: e.target.value as Team})}>
                          {Object.values(Team).map(team => (
                              <option key={team} value={team}>{team}</option>
                          ))}
                      </Select>
                  </div>
                )}
                {managers.length > 0 && (
                    <div>
                        <Label htmlFor="user-manager">Manager</Label>
                        <Select id="user-manager" value={userFormData.managerId || ''} onChange={e => setUserFormData({...userFormData, managerId: e.target.value })}>
                            <option value="">Select a manager</option>
                            {managers.map(manager => (
                                <option key={manager.id} value={manager.id}>{manager.name}</option>
                            ))}
                        </Select>
                    </div>
                )}
                <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setIsUserModalOpen(false)}>Cancel</Button><Button onClick={handleSaveUser}>{isEditMode ? 'Update User' : 'Save User'}</Button></div>
            </div>
        </Modal>
        <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)}>
            <h3 className="text-lg font-medium mb-2">Confirm Deletion</h3>
            <p className="text-slate-600 mb-6">Are you sure you want to delete the user "{userToDelete?.name}"? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setIsConfirmModalOpen(false)}>Cancel</Button>
                <Button variant="danger" onClick={handleConfirmDelete}>Delete</Button>
            </div>
        </Modal>
        <BulkAddModal isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} />
        </>
    );
};

// Sub-component for Error Types management
const ErrorTypesManagement: React.FC = () => {
    const { errorTypes, fetchAdminData, addErrorType, updateErrorType, deleteErrorType } = useAdminStore();
    const { user: currentUser } = useSessionStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [currentErrorType, setCurrentErrorType] = useState<Omit<ErrorType, 'id'> & { id?: string }>({ name: '', description: '' });
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [errorTypeToDelete, setErrorTypeToDelete] = useState<ErrorType | null>(null);

    useEffect(() => { fetchAdminData() // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleOpenModal = (errorType?: ErrorType) => {
        setCurrentErrorType(errorType || { name: '', description: '' });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (currentErrorType.id) {
            await updateErrorType(currentErrorType as ErrorType);
        } else {
            await addErrorType(currentErrorType);
        }
        setIsModalOpen(false);
    };

    const handleDeleteRequest = (errorType: ErrorType) => {
        setErrorTypeToDelete(errorType);
        setIsConfirmModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (errorTypeToDelete) {
            await deleteErrorType(errorTypeToDelete.id);
            setIsConfirmModalOpen(false);
            setErrorTypeToDelete(null);
        }
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div><CardTitle>Error Types</CardTitle><CardDescription>Manage the dropdown values for error types.</CardDescription></div>
                        {currentUser?.role === Role.ADMIN && (
                             <div className="flex items-center gap-2">
                                <Button onClick={() => setIsBulkModalOpen(true)} variant="secondary"><span className="mr-2">{ICONS.upload}</span>Add Bulk Errors</Button>
                                <Button onClick={() => handleOpenModal()}><span className="mr-2">{ICONS.plus}</span>Add Error Type</Button>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {errorTypes.map(et => (
                                <TableRow key={et.id}>
                                    <TableCell>{et.name}</TableCell><TableCell>{et.description}</TableCell>
                                    <TableCell className="space-x-2">
                                        {currentUser?.role === Role.ADMIN && (
                                        <>
                                            <Button onClick={() => handleOpenModal(et)} variant="secondary" size="sm" className="px-2 py-1 h-auto"><span className="text-slate-600">{ICONS.edit}</span></Button>
                                            <Button onClick={() => handleDeleteRequest(et)} variant="danger" size="sm" className="px-2 py-1 h-auto"><span className="text-white">{ICONS.delete}</span></Button>
                                        </>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <h3 className="text-lg font-medium mb-4">{currentErrorType.id ? 'Edit' : 'Add'} Error Type</h3>
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="et-name">Name</Label>
                        <Input id="et-name" value={currentErrorType.name} onChange={e => setCurrentErrorType({...currentErrorType, name: e.target.value})} />
                    </div>
                    <div>
                        <Label htmlFor="et-desc">Description</Label>
                        <Textarea id="et-desc" value={currentErrorType.description} onChange={e => setCurrentErrorType({...currentErrorType, description: e.target.value})} />
                    </div>
                     <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button><Button onClick={handleSave}>Save</Button></div>
                </div>
            </Modal>
            <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)}>
                <h3 className="text-lg font-medium mb-2">Confirm Deletion</h3>
                <p className="text-slate-600 mb-6">Are you sure you want to delete the error type "{errorTypeToDelete?.name}"? This action cannot be undone.</p>
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setIsConfirmModalOpen(false)}>Cancel</Button>
                    <Button variant="danger" onClick={handleConfirmDelete}>Delete</Button>
                </div>
            </Modal>
            <BulkAddErrorTypesModal isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} />
        </>
    );
};

// Sub-component for Automated Messages management
const MessagesManagement: React.FC = () => {
    const { messages, errorTypes, fetchAdminData, addMessage, updateMessage, deleteMessage } = useAdminStore();
    const { user: currentUser } = useSessionStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [currentMessage, setCurrentMessage] = useState<Omit<AutomatedMessage, 'id'> & { id?: string }>({ errorTypeId: '', message: '' });
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [messageToDelete, setMessageToDelete] = useState<AutomatedMessage | null>(null);

     useEffect(() => {
        fetchAdminData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    
    const handleOpenModal = (message?: AutomatedMessage) => {
        if (message) {
            setCurrentMessage(message);
        } else {
            // FIX: Ensure a valid string is passed for errorTypeId, especially when errorTypes array is empty.
            const defaultErrorTypeId = errorTypes[0]?.id || '';
            setCurrentMessage({
                errorTypeId: defaultErrorTypeId,
                message: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (currentMessage.id) {
            await updateMessage(currentMessage as AutomatedMessage);
        } else {
            await addMessage(currentMessage);
        }
        setIsModalOpen(false);
    };

    const handleDeleteRequest = (message: AutomatedMessage) => {
        setMessageToDelete(message);
        setIsConfirmModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (messageToDelete) {
            await deleteMessage(messageToDelete.id);
            setIsConfirmModalOpen(false);
            setMessageToDelete(null);
        }
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div><CardTitle>Automated Messages</CardTitle><CardDescription>Manage automated messages sent for certain error types.</CardDescription></div>
                         {currentUser?.role === Role.ADMIN && (
                            <div className="flex items-center gap-2">
                                <Button onClick={() => setIsBulkModalOpen(true)} variant="secondary"><span className="mr-2">{ICONS.upload}</span>Add Bulk Messages</Button>
                                <Button onClick={() => handleOpenModal()}><span className="mr-2">{ICONS.plus}</span>Add Message</Button>
                            </div>
                         )}
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Error Type</TableHead><TableHead>Message</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {messages.map(msg => (
                                <TableRow key={msg.id}>
                                    <TableCell>{errorTypes.find(et => et.id === msg.errorTypeId)?.name || 'N/A'}</TableCell>
                                    <TableCell>{msg.message}</TableCell>
                                    <TableCell className="space-x-2">
                                        {currentUser?.role === Role.ADMIN && (
                                        <>
                                            <Button onClick={() => handleOpenModal(msg)} variant="secondary" size="sm" className="px-2 py-1 h-auto"><span className="text-slate-600">{ICONS.edit}</span></Button>
                                            <Button onClick={() => handleDeleteRequest(msg)} variant="danger" size="sm" className="px-2 py-1 h-auto"><span className="text-white">{ICONS.delete}</span></Button>
                                        </>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <h3 className="text-lg font-medium mb-4">{currentMessage.id ? 'Edit' : 'Add'} Message</h3>
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="msg-error-type">Error Type</Label>
                        <Select id="msg-error-type" value={currentMessage.errorTypeId} onChange={e => setCurrentMessage({...currentMessage, errorTypeId: e.target.value})}>
                            {errorTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="msg-text">Message</Label>
                        <Textarea id="msg-text" value={currentMessage.message} onChange={e => setCurrentMessage({...currentMessage, message: e.target.value})} />
                    </div>
                     <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button><Button onClick={handleSave}>Save</Button></div>
                </div>
            </Modal>
            <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)}>
                <h3 className="text-lg font-medium mb-2">Confirm Deletion</h3>
                <p className="text-slate-600 mb-6">Are you sure you want to delete this message? This action cannot be undone.</p>
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setIsConfirmModalOpen(false)}>Cancel</Button>
                    <Button variant="danger" onClick={handleConfirmDelete}>Delete</Button>
                </div>
            </Modal>
            <BulkAddMessagesModal isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} />
        </>
    );
};

// Sub-component for Audit Logs
const AuditLogs: React.FC = () => {
    const { logs, users, fetchAdminData } = useAdminStore();
    useEffect(() => { fetchAdminData() // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDownload = () => {
        const headers = [
            { key: 'timestamp', label: 'Timestamp' },
            { key: 'userName', label: 'User' },
            { key: 'action', label: 'Action' },
            { key: 'ticketId', label: 'Ticket ID' },
            { key: 'details', label: 'Details' },
        ];
        
        const dataToExport = logs.map(log => ({
            ...log,
            userName: users.find(u => u.id === log.userId)?.name || 'System',
            timestamp: new Date(log.timestamp).toLocaleString(),
        }));
    
        const csv = convertToCSV(dataToExport, headers);
        downloadCSV(csv, `audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Audit Logs</CardTitle>
                        <CardDescription>Track all actions performed in the system.</CardDescription>
                    </div>
                    <Button variant="secondary" size="sm" onClick={handleDownload}>
                        <span className="mr-2">{ICONS.download}</span>
                        Download
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>Timestamp</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead><TableHead>Ticket ID</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {logs.map(log => (
                            <TableRow key={log.id}>
                                <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                                <TableCell>{users.find(u => u.id === log.userId)?.name || 'System'}</TableCell>
                                <TableCell><Badge>{log.action}</Badge></TableCell>
                                <TableCell>{log.ticketId}</TableCell>
                                <TableCell>{log.details}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};

// Sub-component for Feedback
const FeedbackView: React.FC = () => {
    const { feedbacks, users, fetchAdminData } = useAdminStore();
    useEffect(() => { fetchAdminData() // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <Card>
            <CardHeader><CardTitle>User Feedback</CardTitle><CardDescription>Feedback submitted by PREs.</CardDescription></CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {feedbacks.length > 0 ? (
                        feedbacks.map(feedback => (
                            <div key={feedback.id} className="p-4 bg-slate-50 rounded-lg">
                                <p className="text-slate-800 mb-2">"{feedback.feedback}"</p>
                                <div className="text-xs text-slate-500 flex justify-between">
                                    <span>- {users.find(u => u.id === feedback.preId)?.name || 'Unknown User'}</span>
                                    <span>{new Date(feedback.timestamp).toLocaleString()}</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-slate-500 text-center py-4">No feedback has been submitted yet.</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};


export const AdminDashboard: React.FC<{ activePage: string }> = ({ activePage }) => {
    const { user } = useSessionStore();

    const renderPageContent = () => {
        if (user?.role === Role.DATACR) {
            switch (activePage) {
                case 'error-analytics': return <ErrorAnalytics />;
                case 'detailed-analytics': return <DetailedErrorAnalytics />;
                case 'dashboard':
                default:
                    return <AdminTicketDashboard />;
            }
        }
        
        // Fallback for ADMIN role
        switch (activePage) {
            case 'error-analytics': return <ErrorAnalytics />;
            case 'detailed-analytics': return <DetailedErrorAnalytics />;
            case 'pre-management': return <UserManagement />;
            case 'error-types': return <ErrorTypesManagement />;
            case 'messages': return <MessagesManagement />;
            case 'logs': return <AuditLogs />;
            case 'feedback': return <FeedbackView />;
            case 'dashboard':
            default:
                return <AdminTicketDashboard />;
        }
    };

    return <div className="space-y-6">{renderPageContent()}</div>;
};

// --- BDM / ASM DASHBOARD ---

const AsmBdmTicketForm: React.FC<{ errorTypes: ErrorType[], onSubmit: () => void }> = ({ errorTypes, onSubmit }) => {
    const { addTicket } = useTicketStore();
    const [uid, setUid] = useState('');
    const [errorTypeId, setErrorTypeId] = useState('');
    const [description, setDescription] = useState('');
    const [comment, setComment] = useState('');
    const [subject, setSubject] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<{status: 'idle' | 'success' | 'error', message: string}>({status: 'idle', message: ''});

    const isEmailErrorType = useMemo(() => {
        const emailErrorType = errorTypes.find(et => et.name === 'Email');
        return emailErrorType && errorTypeId === emailErrorType.id;
    }, [errorTypes, errorTypeId]);

    useEffect(() => {
        if (errorTypes.length > 0 && !errorTypeId) {
            setErrorTypeId(errorTypes[0].id);
        }
    }, [errorTypes, errorTypeId]);

    useEffect(() => {
        if (!isEmailErrorType) {
            setSubject('');
        }
    }, [isEmailErrorType]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setAttachment(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uid || !errorTypeId || !description || (isEmailErrorType && !subject)) return;

        setIsSubmitting(true);
        setSubmitStatus({ status: 'idle', message: '' });

        try {
            const attachmentData = attachment ? {
                name: attachment.name,
                type: attachment.type,
                size: attachment.size,
            } : undefined;

            await addTicket({ 
                uid, 
                errorTypeId, 
                description, 
                comment, 
                subject: isEmailErrorType ? subject : undefined, 
                attachment: attachmentData 
            });

            setUid('');
            setErrorTypeId(errorTypes[0]?.id || '');
            setDescription('');
            setComment('');
            setSubject('');
            setAttachment(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            setSubmitStatus({ status: 'success', message: 'Ticket submitted successfully!' });
            setTimeout(() => setSubmitStatus({ status: 'idle', message: '' }), 5000);
            onSubmit();
        } catch(error) {
            const message = error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
            setSubmitStatus({ status: 'error', message });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Create New Ticket</CardTitle>
                <CardDescription>Fill out the form to report an issue.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="uid">UID</Label>
                        <Input id="uid" value={uid} onChange={e => setUid(e.target.value)} placeholder="e.g., UID12345" required />
                    </div>
                    <div>
                        <Label htmlFor="errorType">Error Type</Label>
                        <Select id="errorType" value={errorTypeId} onChange={e => setErrorTypeId(e.target.value)} required>
                            {errorTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
                        </Select>
                    </div>
                     {isEmailErrorType && (
                        <div>
                            <Label htmlFor="subject">Subject</Label>
                            <Input id="subject" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Enter email subject" required />
                        </div>
                    )}
                    <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the issue in detail..." required />
                    </div>
                    <div>
                        <Label htmlFor="comment">Comment (Optional)</Label>
                        <Input id="comment" value={comment} onChange={e => setComment(e.target.value)} placeholder="Any additional comments?" />
                    </div>
                    <div>
                        <Label htmlFor="attachment-asm">Attachment (Optional)</Label>
                        <Input id="attachment-asm" type="file" ref={fileInputRef} onChange={handleFileChange} className="pt-2" />
                        {attachment && (
                            <p className="text-xs text-slate-500 mt-1">Selected: {attachment.name} ({(attachment.size / 1024).toFixed(2)} KB)</p>
                        )}
                    </div>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
                    </Button>
                     {submitStatus.status === 'success' && (
                        <p className="text-sm text-green-600 mt-2 text-center">{submitStatus.message}</p>
                    )}
                    {submitStatus.status === 'error' && (
                        <p className="text-sm text-red-600 mt-2 text-center">{submitStatus.message}</p>
                    )}
                </form>
            </CardContent>
        </Card>
    );
};

const AsmBdmStatusBadge: React.FC<{ status: TicketStatus }> = ({ status }) => {
    const variant = {
        [TicketStatus.COMPLETED]: 'success',
        [TicketStatus.IN_PROGRESS]: 'warning',
        [TicketStatus.ESCALATED]: 'danger',
        [TicketStatus.CLOSED]: 'default',
    }[status] as 'success' | 'warning' | 'danger' | 'default';
    return <Badge variant={variant}>{status}</Badge>;
};

const ManagerTicketTable: React.FC<{ tickets: Ticket[], errorTypes: ErrorType[], users: User[] }> = ({ tickets, errorTypes, users }) => {
    const getErrorTypeName = (id: string) => errorTypes.find(et => et.id === id)?.name || 'Unknown';
    const [copiedUid, setCopiedUid] = useState<string | null>(null);

    const handleCopyUid = (uid: string) => {
        navigator.clipboard.writeText(uid);
        setCopiedUid(uid);
        setTimeout(() => setCopiedUid(null), 2000);
    };

    const getPreName = (preId: string) => {
        return users.find(u => u.id === preId)?.name || 'Unknown';
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>My Submitted Tickets</CardTitle>
                <CardDescription>Tickets you have submitted personally.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Ticket ID</TableHead>
                            <TableHead>UID</TableHead>
                            <TableHead>Submitted By</TableHead>
                            <TableHead>Error Type</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>DataCR Comments</TableHead>
                            <TableHead>Attachment</TableHead>
                            <TableHead>Last Updated</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tickets.length > 0 ? tickets.map(ticket => (
                            <TableRow key={ticket.id}>
                                <TableCell>{ticket.id}</TableCell>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <span>{ticket.uid}</span>
                                        <button
                                            onClick={() => handleCopyUid(ticket.uid)}
                                            className="text-slate-400 hover:text-sky-600 p-1 rounded-md transition-colors"
                                            aria-label={`Copy UID ${ticket.uid}`}
                                        >
                                            {copiedUid === ticket.uid ? <span className="text-green-500">{ICONS.check}</span> : ICONS.copy}
                                        </button>
                                    </div>
                                </TableCell>
                                <TableCell>{getPreName(ticket.preId)}</TableCell>
                                <TableCell>{getErrorTypeName(ticket.errorTypeId)}</TableCell>
                                <TableCell className="text-sm text-slate-600 max-w-xs truncate" title={ticket.subject || ''}>{ticket.subject || '–'}</TableCell>
                                <TableCell><AsmBdmStatusBadge status={ticket.status} /></TableCell>
                                <TableCell className="text-sm text-slate-600 max-w-xs truncate" title={ticket.comment ?? ''}>{ticket.comment || '–'}</TableCell>
                                <TableCell>
                                    {ticket.attachment ? (
                                        <div className="flex items-center gap-2 text-slate-600" title={`${ticket.attachment.name} (${(ticket.attachment.size / 1024).toFixed(2)} KB)`}>
                                            {ICONS.paperclip}
                                            <span className="truncate text-sm">{ticket.attachment.name}</span>
                                        </div>
                                    ) : '–'}
                                </TableCell>
                                <TableCell>{new Date(ticket.updatedAt).toLocaleDateString()}</TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center">You haven't submitted any tickets yet.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};

export const AsmBdmDashboard: React.FC<{ activePage: string }> = ({ activePage }) => {
    const { user } = useSessionStore();
    const { tickets, notifications, fetchTickets, fetchNotifications, kpis, calculateKPIs } = useTicketStore();
    const { users, errorTypes, fetchAdminData } = useAdminStore();
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        fetchTickets();
        fetchAdminData();
        fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshKey]);

    const myTickets = useMemo(() => {
        if (!user) return [];
        return tickets.filter(t => t.preId === user.id);
    }, [user, tickets]);

    useEffect(() => {
        if(user && users.length > 0) {
            calculateKPIs(myTickets);
        }
    }, [myTickets, user, users, calculateKPIs]);

    const myNotifications = notifications.filter(n => n.preId === user?.id);

    const renderPageContent = () => {
        switch (activePage) {
            case 'error-analytics':
                return <ErrorAnalytics />;
            case 'detailed-analytics':
                return <DetailedErrorAnalytics />;
            case 'team-tickets':
                return <TeamTickets />;
            case 'dashboard':
            default:
                return (
                     <>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
                            <StatCard title="My Active Tickets" value={kpis.activeTickets} description="Tickets you've submitted that are in progress." />
                            <StatCard title="My Closed Tickets" value={kpis.closedTickets} description="Tickets you've submitted that are resolved." />
                            <StatCard title="My Avg. Resolution Time" value={kpis.avgTimeToSolve} description="Average time taken to resolve your tickets." />
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            <div>
                                <AsmBdmTicketForm errorTypes={errorTypes} onSubmit={() => setRefreshKey(k => k + 1)} />
                            </div>
                            <Card>
                                <CardHeader>
                                    <CardTitle>System Messages</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {myNotifications.length > 0 ? (
                                        <ul className="space-y-3 max-h-[425px] overflow-y-auto pr-2">
                                            {myNotifications.map(notif => (
                                                <li key={notif.id} className="p-3 bg-sky-50 rounded-lg text-sm">
                                                    <div className="flex justify-between items-start gap-4">
                                                        <p className="text-slate-700">{notif.message}</p>
                                                        <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
                                                            {new Date(notif.timestamp).toLocaleString()}
                                                        </span>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : <p className="text-slate-500">No system messages.</p>}
                                </CardContent>
                            </Card>
                        </div>
                        <ManagerTicketTable tickets={myTickets} errorTypes={errorTypes} users={users} />
                    </>
                );
        }
    };
    return <div className="space-y-6">{renderPageContent()}</div>;
};