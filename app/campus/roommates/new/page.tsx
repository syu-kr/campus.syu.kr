import ProtectedRoommatePage from "@/app/features/roommates/ProtectedRoommatePage";
import RoommateNew from "@/app/features/roommates/RoommateNew";
export default function Page() { return <ProtectedRoommatePage path="/campus/roommates/new"><RoommateNew /></ProtectedRoommatePage>; }
