import ProtectedRoommatePage from "@/app/features/roommates/ProtectedRoommatePage";
import RoommateDetail from "@/app/features/roommates/RoommateDetail";
export default async function Page({ params }: { params: Promise<{ postId: string }> }) { const { postId } = await params; return <ProtectedRoommatePage path={`/campus/roommates/${postId}`}><RoommateDetail postId={postId} /></ProtectedRoommatePage>; }
