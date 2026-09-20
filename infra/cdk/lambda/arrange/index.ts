import type { APIGatewayProxyHandlerV2 } from "aws-lambda";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  return {
    statusCode: 501,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message: "arrange engine not implemented yet",
      receivedBodyLength: event.body?.length ?? 0,
    }),
  };
};
