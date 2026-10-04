import ProtectedRoommatePage from "@/app/features/roommates/ProtectedRoommatePage";
import RoommateList from "@/app/features/roommates/RoommateList";
export default function Page() { return <ProtectedRoommatePage path="/campus/roommates"><RoommateList /></ProtectedRoommatePage>; }
