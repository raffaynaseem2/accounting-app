import DocumentDetail from "../../../components/document-detail";
export default async function BillDetail({ params }: { params: Promise<{ id: string }> }) { return <DocumentDetail kind="bill" id={(await params).id} />; }
