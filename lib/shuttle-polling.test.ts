import {afterEach,expect,it,vi} from "vitest";
import {shuttleRefreshDelay} from "./shuttle-polling";
afterEach(()=>vi.restoreAllMocks());
it("draws 5–10 seconds after each completed fetch, without resetting on clock renders",()=>{
  const random=vi.spyOn(Math,"random").mockReturnValueOnce(0).mockReturnValueOnce(.999999);
  const query={state:{dataUpdatedAt:1,errorUpdatedAt:0}};
  expect(shuttleRefreshDelay(query)).toBe(5000);
  for(let render=0;render<20;render++)expect(shuttleRefreshDelay(query)).toBe(5000);
  expect(random).toHaveBeenCalledTimes(1);
  query.state.dataUpdatedAt=2;expect(shuttleRefreshDelay(query)).toBe(10000);
});
