import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function DashboardSettingsPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-4 space-y-4">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Update your profile and preferences.
        </p>
      </header>

      <div className="grid gap-4 md:max-w-2xl md:grid-cols-2 md:mx-auto md:px-0">
        {/* Profile */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Display name</label>
              <Input placeholder="Your display name" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input type="email" placeholder="you@example.com" />
            </div>

            <Button className="w-full sm:w-auto">Save changes</Button>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Preferences</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Theme</label>

              {/* segmented-control style */}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="w-full">
                  Light
                </Button>
                <Button className="w-full">Dark</Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Choose how the app looks on your device.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


















 
 

 
 
 
 
 
 

 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 

