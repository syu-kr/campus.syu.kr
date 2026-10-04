import ProtectedRoommatePage from "@/app/features/roommates/ProtectedRoommatePage";
import RoommateMine from "@/app/features/roommates/RoommateMine";
export default function Page() { return <ProtectedRoommatePage path="/campus/roommates/me"><RoommateMine /></ProtectedRoommatePage>; }
