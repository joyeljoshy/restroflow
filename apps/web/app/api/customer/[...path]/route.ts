import { proxyCustomerRequest } from "@/lib/customer-proxy";

export const runtime = "nodejs";
export const maxDuration = 90;

async function handle(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxyCustomerRequest(request, (await params).path);
}

export {
  handle as GET,
  handle as POST,
  handle as HEAD,
  handle as OPTIONS,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
