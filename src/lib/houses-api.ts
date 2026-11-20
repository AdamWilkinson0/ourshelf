import { createServerFn } from "@tanstack/react-start";
import { houseCommand, type HouseCommand, type HouseReplies } from "./shared-houses";

const houseRpc = createServerFn({ method: "POST" })
  .validator(houseCommand)
  .handler(async ({ data }) => {
    const { handleHouse } = await import("./houses.server");
    return handleHouse(data);
  });

export async function callHouse<T extends HouseCommand>(
  data: T,
  token: string,
): Promise<HouseReplies[T["type"]]> {
  const result = await houseRpc({ data, headers: { Authorization: "Bearer " + token } });
  if (!result.ok) throw Error(result.message);
  return result.data as HouseReplies[T["type"]];
}
