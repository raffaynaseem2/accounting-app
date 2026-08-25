"use client";

import { useState } from "react";

const reports = ["Trial balance", "Income statement", "Balance sheet", "Cash flow statement"];

export default function ReportsPage() {
  const [active, setActive] = useState(reports[0]);
  return <main><div className="page-heading"><div><h1>Reports</h1><p>Financial summaries for your account</p></div></div><section className="panel"><div className="report-tabs">{reports.map((report) => <button className={active === report ? "report-tab active" : "report-tab"} key={report} onClick={() => setActive(report)}>{report}</button>)}</div><div className="report-empty"><h2>{active}</h2><p>Report data will appear here as transactions are recorded.</p></div></section></main>;
}
