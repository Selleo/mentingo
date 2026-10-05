import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PERMISSIONS, SCORM_PACKAGE_STATUS } from "@repo/shared";

import { DatabasePg } from "src/common";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { streamFileToResponse } from "src/file/utils/streamFileToResponse";
import { SessionRevocationService } from "src/redis";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { SupportModeService } from "src/support-mode/support-mode.service";
import { extractToken } from "src/utils/extract-token";

import { ScormRepository } from "../repositories/scorm.repository";
import { normalizeScormRelativePath } from "../scorm-storage-paths";
import { ScormService } from "../scorm.service";

import { ScormContentGrantService, type ScormGrant } from "./scorm-content-grant.service";
import { contentHeaders, resolveScormContentConfig } from "./scorm-content.config";

import type { Request, Response } from "express";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

const runtimeJs = readFileSync(
  join(dirname(require.resolve("scorm-again")), "scorm12.min.js"),
  "utf8",
);

@Injectable()
export class ScormContentService {
  constructor(
    private readonly grants: ScormContentGrantService,
    private readonly repository: ScormRepository,
    private readonly scorm: ScormService,
    private readonly runner: TenantDbRunnerService,
    private readonly revoked: SessionRevocationService,
    private readonly supportMode: SupportModeService,

    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
  ) {}

  configFor(parentOrigin: string) {
    return resolveScormContentConfig(process.env, parentOrigin);
  }
  private getHost(req: Request) {
    return req.headers.host?.toLowerCase();
  }
  assertContentHost(req: Request) {
    const origin = resolveScormContentConfig(process.env, "https://unused.lms.localhost").origin;
    if (this.getHost(req) !== new URL(origin).host) throw new NotFoundException();
  }
  async parentOrigin(actor: CurrentUserType) {
    // The tenant host is an administrator-owned setting, never a browser-supplied Origin header.
    return (await resolveTenantOrigin(this.dbAdmin, actor.tenantId)).replace(/\/$/u, "");
  }
  async launch<T extends { packageId: UUIDType; launchUrl: string }>(
    launch: T,
    actor: CurrentUserType,
    req: Request,
  ): Promise<T> {
    const parentOrigin = await this.parentOrigin(actor);
    const config = this.configFor(parentOrigin);
    const credential = extractToken(req, "access_token");
    const pkg = await this.repository.findPackageById(launch.packageId);
    if (!pkg || pkg.status !== SCORM_PACKAGE_STATUS.READY || !credential)
      throw new ForbiddenException();
    const relativePath = decodeURIComponent(
      launch.launchUrl.split(`/api/scorm/content/${launch.packageId}/`)[1] || "",
    );
    const token = await this.grants.create({
      actor,
      credential,
      credentialExpiresAt: (actor.exp || 0) * 1000,
      packageId: launch.packageId,
      extractedFilesReference: pkg.extractedFilesReference,
      launchPath: relativePath,
      parentOrigin,
    });
    return { ...launch, launchUrl: `${config.origin}/api/scorm/delivery/${token}/player` };
  }
  async validateGrant(token: string, req: Request): Promise<ScormGrant> {
    this.assertContentHost(req);
    const grant = await this.grants.read(token);
    if (!grant) throw new NotFoundException();
    const config = this.configFor(grant.parentOrigin);
    if (config.origin === grant.parentOrigin) throw new NotFoundException();
    // Validate the exact access credential that minted the grant, not just its cached actor.
    // An individual logout revokes this digest; user-wide revocation is checked on each read.
    if (await this.revoked.isUserRevoked(grant.actor.userId)) throw new NotFoundException();
    if (grant.actor.exp && grant.actor.exp * 1000 <= Date.now()) throw new NotFoundException();
    if (grant.actor.isSupportMode && Date.parse(grant.actor.supportExpiresAt || "") <= Date.now())
      throw new NotFoundException();
    if (grant.actor.isSupportMode) {
      if (!grant.actor.supportSessionId) throw new NotFoundException();
      await this.supportMode.assertActiveSession(grant.actor.supportSessionId);
    }
    await this.runner.runWithTenant(grant.actor.tenantId, async () => {
      const pkg = await this.repository.findPackageById(grant.packageId);
      if (
        !pkg ||
        pkg.status !== SCORM_PACKAGE_STATUS.READY ||
        pkg.extractedFilesReference !== grant.extractedFilesReference
      )
        throw new NotFoundException();
      if (!grant.actor.permissions.includes(PERMISSIONS.COURSE_READ)) throw new NotFoundException();
      await this.scorm.assertDeliveryAccess(grant.packageId as UUIDType, grant.actor);
    });
    return grant;
  }
  headers(res: Response, grant: ScormGrant) {
    res.set(contentHeaders(this.configFor(grant.parentOrigin)));
    res.setHeader("Content-Disposition", "inline");
  }
  async renew(token: string, actor: CurrentUserType, req: Request) {
    const grant = await this.grants.read(token);
    if (!grant || grant.actor.tenantId !== actor.tenantId || grant.actor.userId !== actor.userId)
      throw new ForbiddenException();
    // Revalidate package entitlement on every renewal, not just at initial launch.
    await this.scorm.assertDeliveryAccess(grant.packageId as UUIDType, actor);
    const credential = extractToken(req, "access_token");
    if (!credential) throw new ForbiddenException();
    await this.grants.renew(token, actor, credential);
  }
  async deliver(token: string, relativePath: string, req: Request, res: Response) {
    const grant = await this.validateGrant(token, req);
    this.headers(res, grant);
    if (relativePath === "player") {
      const path = grant.launchPath.split(/[?#]/u)[0];
      const suffix = grant.launchPath.slice(path.length);
      const asset = `/api/scorm/delivery/${token}/assets/${normalizeScormRelativePath(path).split("/").map(encodeURIComponent).join("/")}${suffix}`;
      const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0"><script src="/api/scorm/delivery/${token}/runtime.js"></script><script src="/api/scorm/delivery/${token}/bootstrap.js"></script><iframe id="sco" style="border:0;width:100%;height:100vh" title="SCORM content"></iframe><script>window.scormAsset=${JSON.stringify(asset)}</script></body></html>`;
      return res.type("html").send(html);
    }
    if (relativePath === "runtime.js") return res.type("application/javascript").send(runtimeJs);
    if (relativePath === "bootstrap.js")
      return res.type("application/javascript").send(this.bootstrap(token, grant.parentOrigin));
    if (!relativePath.startsWith("assets/")) throw new NotFoundException();
    const asset = normalizeScormRelativePath(relativePath.slice(7));
    const file = await this.runner.runWithTenant(grant.actor.tenantId, () =>
      this.scorm.getContentFile({
        packageId: grant.packageId as UUIDType,
        relativePath: asset,
        currentUser: grant.actor,
        range: req.headers.range,
      }),
    );
    streamFileToResponse(res, file);
  }
  private bootstrap(token: string, parentOrigin: string) {
    // Values enter via JSON.stringify, not HTML or executable string interpolation.
    return `(()=>{const channel=${JSON.stringify(token)},parentOrigin=${JSON.stringify(parentOrigin)};
      const api=new window.Scorm12API({autocommit:false,dataCommitFormat:'flattened',logLevel:'ERROR',sendFullCommit:false});
      window.API=api;const session=crypto.randomUUID();let sequence=0,ready=false,finished=false,postFinishError=false;
      const lastError=api.LMSGetLastError.bind(api);
      api.LMSGetLastError=()=>postFinishError?'101':lastError();
      for(const method of ['LMSInitialize','LMSSetValue','LMSCommit','LMSFinish']){
        const local=api[method].bind(api);
        api[method]=(...params)=>{if(finished){postFinishError=true;return 'false'}postFinishError=false;const result=local(...params);
          if(result==='true' && api.LMSGetLastError()==='0' && ready){
            parent.postMessage({type:'mentingo:scorm:call',channel,session,sequence:++sequence,method,params},parentOrigin);
            if(method==='LMSFinish')finished=true;
          }
          return result;
        };
      }
      const sendReady=()=>{if(!ready)parent.postMessage({type:'mentingo:scorm:ready',channel,session},parentOrigin)};
      const timer=setInterval(sendReady,500);sendReady();setTimeout(()=>clearInterval(timer),30000);
      addEventListener('message',(event)=>{if(event.source!==parent||event.origin!==parentOrigin||ready)return;
        const message=event.data;if(!message||message.type!=='mentingo:scorm:initialize'||message.channel!==channel||message.session!==session||!message.runtime||typeof message.runtime!=='object'||Array.isArray(message.runtime))return;
        ready=true;clearInterval(timer);api.loadFromFlattenedJSON(message.runtime);
        document.getElementById('sco').src=window.scormAsset;
      });
    })();`;
  }
}
