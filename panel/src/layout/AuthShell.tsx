import { Route, Switch } from "wouter";
import Login from "../pages/auth/Login";
import CfxreCallback from "../pages/auth/CfxreCallback";
import DiscordCallback from "../pages/auth/DiscordCallback";
import AddMasterPin from "../pages/auth/AddMasterPin";
import AddMasterCallback from "../pages/auth/AddMasterCallback";
import { Card } from "../components/ui/card";
import { LogoFullSquareGreen } from "@/components/Logos";
import { useThemedImage } from "@/hooks/theme";
import { handleExternalLinkClick } from "@/lib/navigation";
import { AuthError } from "@/pages/auth/errors";
import DynamicAdvert from "@/components/DynamicAdvert";

function AuthContentWrapper({ children }: { children: React.ReactNode }) {
  return <div className="text-center">{children}</div>;
}

export default function AuthShell() {
  const customLogoUrl = useThemedImage(window.txConsts.providerLogo);
  return (
    <div className="min-h-screen flex items-center justify-center pattern-dots">
      <div className="w-full min-w-[20rem] xs:max-w-[25rem] my-4 xs:mx-4">
        {customLogoUrl ? (
          <img
            className="max-w-36 xs:max-w-56 max-h-16 xs:max-h-24 m-auto"
            src={customLogoUrl}
            alt={window.txConsts.providerName}
          />
        ) : (
          <LogoFullSquareGreen className="w-36 xs:w-52 mx-auto" />
        )}

        <Card className="min-h-80 mt-4 xs:mt-8 mb-4 flex items-center justify-center bg-card/40 rounded-none xs:rounded-lg">
          <Switch>
            <Route path="/login">
              <Login />
            </Route>
            <Route path="/login/callback">
              <AuthContentWrapper>
                <CfxreCallback />
              </AuthContentWrapper>
            </Route>
            <Route path="/login/discord/callback">
              <AuthContentWrapper>
                <DiscordCallback />
              </AuthContentWrapper>
            </Route>
            <Route path="/addMaster/pin">
              <AuthContentWrapper>
                <AddMasterPin />
              </AuthContentWrapper>
            </Route>
            <Route path="/addMaster/callback">
              <AuthContentWrapper>
                <AddMasterCallback />
              </AuthContentWrapper>
            </Route>
            <Route path="/:fullPath*">
              <AuthContentWrapper>
                <AuthError
                  error={{
                    errorTitle: "Page Not Found",
                    errorMessage:
                      "The requested page was not found in the authentication router.",
                  }}
                />
              </AuthContentWrapper>
            </Route>
          </Switch>
        </Card>

        {/* Footer ad/info */}
        <div className="text-xs text-muted-foreground text-center">
          <DynamicAdvert />
          <div className="mt-2 text-zinc-500">
            txAdmin {window.txConsts.txaVersion} | FXServer{" "}
            {window.txConsts.fxsVersion}
          </div>
        </div>
      </div>
    </div>
  );
}
