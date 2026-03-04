import { QueryClient } from "@tanstack/react-query";

export const refreshWebsiteData = async (queryClient: QueryClient): Promise<void> => {
  await queryClient.invalidateQueries();
  await queryClient.refetchQueries({ type: "active" });
};
