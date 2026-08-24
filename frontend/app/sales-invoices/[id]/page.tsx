import DocumentDetail from "../../../components/document-detail";
export default async function InvoiceDetail({ params }: { params: Promise<{ id: string }> }) { return <DocumentDetail kind="invoice" id={(await params).id} />; }
